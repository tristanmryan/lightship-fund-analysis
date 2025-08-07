// api/ycharts.js - Serverless function for Ycharts API calls
// This handles secure API calls to Ycharts with rate limiting and error handling

const YCHARTS_API_KEY = process.env.YCHARTS_API_KEY;
const YCHARTS_BASE_URL = 'https://ycharts.com/api/v3';

// Rate limiting storage (in production, use Redis or similar)
const rateLimit = {
  requests: new Map(),
  maxRequests: 100, // per hour per IP
  windowMs: 60 * 60 * 1000 // 1 hour
};

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

// Make request to Ycharts API
async function makeYchartsRequest(endpoint, params = {}) {
  const url = new URL(`${YCHARTS_BASE_URL}${endpoint}`);
  url.searchParams.append('apikey', YCHARTS_API_KEY);
  
  // Add additional parameters
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      url.searchParams.append(key, value);
    }
  });

  console.log(`Making Ycharts API request to: ${endpoint}`);
  
  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Lightship-Fund-Analysis/1.0'
    }
  });

  if (!response.ok) {
    throw new Error(`Ycharts API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  if (data.error) {
    throw new Error(`Ycharts API error: ${data.error}`);
  }

  return data;
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
        
        result = await makeYchartsRequest('/funds', {
          ticker: ticker.toUpperCase(),
          fields: fields || 'ticker,name,asset_class,expense_ratio,ytd_return,one_year_return,three_year_return,five_year_return,ten_year_return,sharpe_ratio,standard_deviation,alpha,beta,manager_tenure,up_capture_ratio,down_capture_ratio,category_rank,sec_yield,fund_family'
        });
        break;

      case 'getHistoricalData':
        if (!ticker) {
          return res.status(400).json({ error: 'Ticker parameter required' });
        }
        
        result = await makeYchartsRequest('/funds/historical', {
          ticker: ticker.toUpperCase(),
          period: period || '1y'
        });
        break;

      case 'searchFunds':
        if (!query) {
          return res.status(400).json({ error: 'Query parameter required' });
        }
        
        result = await makeYchartsRequest('/funds/search', {
          query: query,
          limit: limit || 10
        });
        break;

      default:
        return res.status(400).json({ error: 'Invalid action. Supported: getFundData, getHistoricalData, searchFunds' });
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