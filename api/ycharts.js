// api/ycharts.js - Serverless function for Ycharts API calls
// This handles secure API calls to Ycharts with rate limiting and error handling

const YCHARTS_API_KEY = process.env.YCHARTS_API_KEY;
const YCHARTS_BASE_URL = 'https://api.ycharts.com/v3';

// Rate limiting storage (in production, use Redis or similar)
// Based on YCharts API limits: 10 requests/second, 10,000 requests/hour
const rateLimit = {
  requests: new Map(),
  burstRequests: new Map(),
  maxBurstRequests: 8, // Slightly under 10 req/sec for safety
  maxHourlyRequests: 9000, // Under 10,000/hour for safety
  burstWindowMs: 1000, // 1 second
  hourlyWindowMs: 60 * 60 * 1000 // 1 hour
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

// Check rate limiting (both burst and sustained)
function checkRateLimit(ip) {
  const now = Date.now();
  
  // Check burst rate limit (8 req/sec for safety)
  const burstRequests = rateLimit.burstRequests.get(ip) || [];
  const recentBurstRequests = burstRequests.filter(timestamp => 
    now - timestamp < rateLimit.burstWindowMs
  );
  
  if (recentBurstRequests.length >= rateLimit.maxBurstRequests) {
    return { 
      allowed: false, 
      reason: 'burst_limit',
      retryAfter: Math.ceil((rateLimit.burstWindowMs - (now - Math.min(...recentBurstRequests))) / 1000)
    };
  }
  
  // Check sustained rate limit (9000 req/hour for safety)
  const hourlyRequests = rateLimit.requests.get(ip) || [];
  const recentHourlyRequests = hourlyRequests.filter(timestamp => 
    now - timestamp < rateLimit.hourlyWindowMs
  );
  
  if (recentHourlyRequests.length >= rateLimit.maxHourlyRequests) {
    return { 
      allowed: false, 
      reason: 'hourly_limit',
      retryAfter: Math.ceil((rateLimit.hourlyWindowMs - (now - Math.min(...recentHourlyRequests))) / 1000)
    };
  }
  
  // Add current request to both trackers
  recentBurstRequests.push(now);
  recentHourlyRequests.push(now);
  rateLimit.burstRequests.set(ip, recentBurstRequests);
  rateLimit.requests.set(ip, recentHourlyRequests);
  
  return { allowed: true };
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
  console.log(`Full URL: ${url.toString()}`);
  console.log(`API Key present: ${YCHARTS_API_KEY ? 'Yes' : 'No'}`);
  console.log(`API Key length: ${YCHARTS_API_KEY ? YCHARTS_API_KEY.length : 0}`);
  
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
  const rateLimitResult = checkRateLimit(clientIP);
  if (!rateLimitResult.allowed) {
    const message = rateLimitResult.reason === 'burst_limit' 
      ? 'Burst rate limit exceeded (max 8 requests per second)'
      : 'Hourly rate limit exceeded (max 9000 requests per hour)';
    
    return res.status(429).json({ 
      error: message,
      retryAfter: rateLimitResult.retryAfter,
      rateLimitType: rateLimitResult.reason
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
        
        // Log API usage for monitoring
        console.log(`📊 API Request: ${ticker.toUpperCase()} at ${new Date().toISOString()}`);
        
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

      case 'testConnection':
        // Simple test to verify API key and basic connectivity
        console.log('🧪 Testing basic API connectivity...');
        const testUrl = new URL(`${YCHARTS_BASE_URL}/companies/AAPL/points/price`);
        
        console.log(`Test URL: ${testUrl.toString()}`);
        console.log(`API Key present: ${YCHARTS_API_KEY ? 'Yes' : 'No'}`);
        console.log(`API Key length: ${YCHARTS_API_KEY ? YCHARTS_API_KEY.length : 0}`);
        
        const testResponse = await fetch(testUrl.toString(), {
          method: 'GET',
          headers: {
            'X-YCHARTSAUTHORIZATION': YCHARTS_API_KEY,
            'Content-Type': 'application/json',
            'User-Agent': 'Lightship-Fund-Analysis/1.0'
          }
        });
        
        const testData = await testResponse.text();
        
        result = {
          success: testResponse.ok,
          status: testResponse.status,
          statusText: testResponse.statusText,
          response: testData,
          headers: Object.fromEntries(testResponse.headers.entries())
        };
        break;

      default:
        return res.status(400).json({ error: 'Invalid action. Supported: getFundData, getHistoricalData, testConnection' });
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
    
    // Parse error for better handling
    let errorStatus = 500;
    let errorMessage = error.message;
    let helpfulMessage = 'Failed to fetch data from Ycharts API';
    
    // Handle specific error types
    if (error.message.includes('403')) {
      errorStatus = 403;
      helpfulMessage = 'YCharts API rate limit exceeded - using mock data fallback';
      if (error.message.includes('API limit exceeded')) {
        helpfulMessage = 'YCharts API daily/hourly limit reached. Please check your API plan or wait before trying again.';
      }
    } else if (error.message.includes('401')) {
      errorStatus = 401;
      helpfulMessage = 'YCharts API authentication failed - please check your API key';
    } else if (error.message.includes('404')) {
      errorStatus = 404;
      helpfulMessage = 'YCharts API endpoint not found - ticker may not exist or endpoint may be incorrect';
    }
    
    // Return detailed error response
    res.status(errorStatus).json({ 
      error: helpfulMessage,
      message: errorMessage,
      timestamp: new Date().toISOString(),
      apiStatus: errorStatus,
      suggestion: errorStatus === 403 ? 
        'Consider upgrading your YCharts API plan or implementing request caching to reduce API calls' :
        'Please check your API configuration and try again'
    });
  }
}