// api/ycharts.js - Serverless function for Ycharts API calls
// This handles secure API calls to Ycharts with rate limiting and error handling

const YCHARTS_API_KEY = process.env.YCHARTS_API_KEY;
const YCHARTS_BASE_URL = 'https://api.ycharts.com/v3';

// Rate limiting storage (in production, use Redis or similar)
const rateLimit = {
  requests: new Map(),
  maxRequests: 100, // per hour per IP
  windowMs: 60 * 60 * 1000 // 1 hour
};

// Security type detection logic
function getSecurityType(ticker) {
  // Common ETFs
  const etfs = [
    'SPY', 'QQQ', 'IWM', 'VTI', 'VEA', 'VWO', 'AGG', 'LQD', 'HYG', 'TLT',
    'GLD', 'SLV', 'USO', 'XLF', 'XLE', 'XLK', 'XLV', 'XLI', 'XLU', 'XLB',
    'ARKK', 'ARKQ', 'ARKG', 'ARKW', 'ARKF', 'SCHD', 'VXUS', 'BND', 'VTEB',
    'VYM', 'VIG', 'VGIT', 'VGLT', 'VMOT', 'VCIT', 'VCLT', 'VNQ', 'VNQI'
  ];
  
  // Common mutual fund patterns (usually end in X)
  const mutualFundPatterns = [
    /.*X$/,     // Most mutual funds end in X
    /^VTSAX$/,  // Vanguard Admiral shares
    /^FXNAX$/,  // Fidelity funds
    /^VTSMX$/,  // Vanguard Investor shares
    /.*AX$/,    // Admiral shares pattern
    /.*IX$/,    // Institutional shares pattern
  ];
  
  // Check if it's a known ETF
  if (etfs.includes(ticker.toUpperCase())) {
    return 'etf';
  }
  
  // Check if it matches mutual fund patterns
  if (mutualFundPatterns.some(pattern => pattern.test(ticker.toUpperCase()))) {
    return 'mutual_fund';
  }
  
  // Default to stock for individual companies
  return 'stock';
}

// Get correct endpoint and metrics for security type
function getEndpointConfig(ticker, securityType) {
  const baseMetrics = [
    'price',
    'market_cap',
    'pe_ratio',
    'dividend_yield',
    'total_return_1y',
    'total_return_3y', 
    'total_return_5y',
    'total_return_10y',
    'total_return_ytd',
    'expense_ratio',
    'sharpe_ratio_3y',
    'standard_deviation_3y',
    'standard_deviation_5y',
    'alpha_5y',
    'beta_5y',
    'upside_capture_ratio',
    'downside_capture_ratio'
  ];

  let endpoint;
  let metrics = [...baseMetrics]; // Create a copy
  
  switch (securityType) {
    case 'mutual_fund':
      // Add mutual fund specific metrics
      metrics.push('manager_tenure', 'category_rank', 'fund_family');
      endpoint = `/mutual_funds/M:${ticker}/points/${metrics.join(',')}`;
      break;
      
    case 'etf':
    case 'stock':
    default:
      endpoint = `/companies/${ticker}/points/${metrics.join(',')}`;
      break;
  }
  
  return { endpoint, metrics };
}

// Check rate limiting
function checkRateLimit(ip) {
  const now = Date.now();
  const userRequests = rateLimit.requests.get(ip) || [];
  
  // Remove old requests outside the window
  const recentRequests = userRequests.filter(time => now - time < rateLimit.windowMs);
  
  if (recentRequests.length >= rateLimit.maxRequests) {
    return false; // Rate limited
  }
  
  // Add current request
  recentRequests.push(now);
  rateLimit.requests.set(ip, recentRequests);
  return true;
}

// Make request to Ycharts API with correct authentication
async function makeYchartsRequest(ticker, securityType = null) {
  // Auto-detect security type if not provided
  if (!securityType) {
    securityType = getSecurityType(ticker);
  }
  
  // Get correct endpoint and metrics for this security type
  const { endpoint, metrics } = getEndpointConfig(ticker, securityType);
  
  const url = new URL(`${YCHARTS_BASE_URL}${endpoint}`);
  
  console.log(`Making Ycharts API request for ${ticker} (${securityType}): ${endpoint}`);
  
  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'X-YCHARTSAUTHORIZATION': YCHARTS_API_KEY,
      'Content-Type': 'application/json',
      'User-Agent': 'Lightship-Fund-Analysis/1.0'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ycharts API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  
  if (data.error) {
    throw new Error(`Ycharts API error: ${data.error}`);
  }

  // Transform YCharts response to our expected format
  return transformYchartsResponse(data, ticker, securityType);
}

// Transform YCharts API response to our expected format
function transformYchartsResponse(data, ticker, securityType) {
  // YCharts returns data in points format: { "data": [{"date": "2024-01-01", "value": 123}] }
  const points = data.data || [];
  
  // Get the most recent values for each metric
  const latestValues = {};
  points.forEach(point => {
    if (point.indicator && point.data && point.data.length > 0) {
      // Get the most recent value
      const latest = point.data[point.data.length - 1];
      latestValues[point.indicator] = latest.value;
    }
  });
  
  // Map YCharts metric names to our database field names
  const mappedData = {
    ticker: ticker.toUpperCase(),
    name: `${ticker.toUpperCase()} ${securityType === 'mutual_fund' ? 'Fund' : securityType === 'etf' ? 'ETF' : 'Stock'}`,
    asset_class: inferAssetClass(ticker, securityType),
    expense_ratio: latestValues.expense_ratio || null,
    ytd_return: latestValues.total_return_ytd || null,
    one_year_return: latestValues.total_return_1y || null,
    three_year_return: latestValues.total_return_3y || null,
    five_year_return: latestValues.total_return_5y || null,
    ten_year_return: latestValues.total_return_10y || null,
    sharpe_ratio: latestValues.sharpe_ratio_3y || null,
    standard_deviation: latestValues.standard_deviation_3y || latestValues.standard_deviation_5y || null,
    alpha: latestValues.alpha_5y || null,
    beta: latestValues.beta_5y || null,
    manager_tenure: latestValues.manager_tenure || null,
    // NEW: Capture ratios (20% of scoring!)
    up_capture_ratio: latestValues.upside_capture_ratio || null,
    down_capture_ratio: latestValues.downside_capture_ratio || null,
    category_rank: latestValues.category_rank || null,
    sec_yield: latestValues.dividend_yield || null, // Use dividend yield as proxy
    fund_family: latestValues.fund_family || inferFundFamily(ticker)
  };
  
  console.log(`✅ Transformed YCharts data for ${ticker}:`, mappedData);
  return mappedData;
}

// Infer asset class from ticker and security type
function inferAssetClass(ticker, securityType) {
  const ticker_upper = ticker.toUpperCase();
  
  // Asset class mappings based on common patterns
  const assetClassMap = {
    // Large Cap Growth
    'QQQ': 'Large Cap Growth', 'XLK': 'Large Cap Growth', 'VTI': 'Large Cap Growth',
    'ARKK': 'Large Cap Growth', 'ARKQ': 'Large Cap Growth', 'ARKG': 'Large Cap Growth',
    
    // Large Cap Value  
    'SPY': 'Large Cap Value', 'VYM': 'Large Cap Value', 'SCHD': 'Large Cap Value',
    
    // International
    'VEA': 'International', 'VXUS': 'International', 'VWO': 'Emerging Markets',
    
    // Bonds
    'AGG': 'Bonds', 'BND': 'Bonds', 'TLT': 'Bonds', 'LQD': 'Bonds', 'HYG': 'Bonds',
    
    // Real Estate
    'VNQ': 'Real Estate', 'VNQI': 'Real Estate',
    
    // Commodities
    'GLD': 'Commodities', 'SLV': 'Commodities', 'USO': 'Commodities'
  };
  
  if (assetClassMap[ticker_upper]) {
    return assetClassMap[ticker_upper];
  }
  
  // Default based on security type
  if (securityType === 'mutual_fund') {
    if (ticker_upper.includes('BOND') || ticker_upper.includes('FI')) return 'Bonds';
    if (ticker_upper.includes('INTL') || ticker_upper.includes('INTER')) return 'International';
    return 'Large Cap Growth'; // Default for mutual funds
  }
  
  return 'Unassigned';
}

// Infer fund family from ticker
function inferFundFamily(ticker) {
  const ticker_upper = ticker.toUpperCase();
  
  if (ticker_upper.startsWith('V')) return 'Vanguard';
  if (ticker_upper.startsWith('F')) return 'Fidelity';
  if (ticker_upper.startsWith('T')) return 'T. Rowe Price';
  if (ticker_upper.startsWith('ARK')) return 'ARK Invest';
  if (ticker_upper.startsWith('SCH')) return 'Schwab';
  if (ticker_upper.startsWith('SPY') || ticker_upper.startsWith('XL')) return 'SPDR';
  
  return 'Unknown';
}

// Main serverless function handler
export default async function handler(req, res) {
  // Enable CORS for your domain
  const allowedOrigins = [
    'http://localhost:3000',
    'https://lightship-fund-analysis.vercel.app',
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null
  ].filter(Boolean);

  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check if API key is configured
  if (!YCHARTS_API_KEY) {
    return res.status(500).json({ error: 'Ycharts API key not configured' });
  }

  // Get client IP for rate limiting
  const clientIP = req.headers['x-forwarded-for'] || 
                   req.headers['x-real-ip'] || 
                   req.connection?.remoteAddress || 
                   'unknown';

  // Check rate limiting
  if (!checkRateLimit(clientIP)) {
    return res.status(429).json({ 
      error: 'Rate limit exceeded',
      message: 'Too many requests. Please try again later.'
    });
  }

  try {
    const { action, ticker, fields, query, period, limit } = req.query;

    if (!action) {
      return res.status(400).json({ error: 'Action parameter required' });
    }

    let result;

    switch (action) {
      case 'getFundData':
        if (!ticker) {
          return res.status(400).json({ error: 'Ticker parameter required' });
        }
        
        // Use the new YCharts API with automatic security type detection
        result = await makeYchartsRequest(ticker.toUpperCase());
        break;

      case 'getHistoricalData':
        if (!ticker) {
          return res.status(400).json({ error: 'Ticker parameter required' });
        }
        
        // For now, return the same current data (historical endpoints are different)
        result = await makeYchartsRequest(ticker.toUpperCase());
        break;

      case 'searchFunds':
        if (!query) {
          return res.status(400).json({ error: 'Query parameter required' });
        }
        
        // Search functionality would need different implementation
        return res.status(501).json({ error: 'Search functionality not yet implemented with new API structure' });

      default:
        return res.status(400).json({ error: 'Invalid action. Supported: getFundData, getHistoricalData' });
    }

    // Log successful request (for monitoring)
    console.log(`✅ Ycharts API request successful: ${action} for ${ticker || query}`);

    // Return successful response
    res.status(200).json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Ycharts API error:', error.message);
    
    // Return error response
    res.status(500).json({ 
      error: 'Failed to fetch data from Ycharts API',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}