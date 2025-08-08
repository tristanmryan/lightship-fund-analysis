// src/services/ychartsAPI.js


class YchartsAPI {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://ycharts.com/api/v3';
    this.cache = new Map();
    this.cacheTimeout = 60 * 60 * 1000; // 1 hour cache
    
    // Use serverless function in production, mock data in development
    this.useServerless = process.env.NODE_ENV === 'production';
    this.serverlessUrl = process.env.REACT_APP_SERVERLESS_URL || '/api/ycharts';
    this.useMockData = process.env.NODE_ENV === 'development';
  }

  // Get cached data or fetch from API
  async getCachedData(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  // Set cache data
  setCachedData(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  // Make API request with error handling and CORS support
  async makeRequest(endpoint, params = {}) {
    // Use serverless function in production, mock data in development
    if (this.useServerless) {
      return this.makeServerlessRequest(endpoint, params);
    } else if (this.useMockData) {
      console.log('Using mock data for development');
      return this.getMockData(params.ticker || 'VTSAX');
    }

    // Direct API call (fallback, not recommended for production)
    const url = new URL(`${this.baseUrl}${endpoint}`);
    url.searchParams.append('apikey', this.apiKey);
    
    // Add additional parameters
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        url.searchParams.append(key, value);
      }
    });

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        throw new Error(`Ycharts API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Check for API error responses
      if (data.error) {
        throw new Error(`Ycharts API error: ${data.error}`);
      }

      return data;
    } catch (error) {
      console.error('Ycharts API request failed:', error);
      
      // Return mock data if API fails
      console.log('API failed, using mock data...');
      return this.getMockData(params.ticker || 'VTSAX');
    }
  }

  // Make request through serverless function (production)
  async makeServerlessRequest(endpoint, params = {}) {
    try {
      console.log('🚀 Using serverless API for real Ycharts data');
      
      const url = new URL(this.serverlessUrl, window.location.origin);
      
      // Map endpoint to action
      let action;
      if (endpoint.includes('/funds') && !endpoint.includes('/historical')) {
        action = 'getFundData';
      } else if (endpoint.includes('/historical')) {
        action = 'getHistoricalData';
      } else if (endpoint.includes('/search')) {
        action = 'searchFunds';
      } else {
        action = 'getFundData'; // default
      }
      
      // Add parameters
      url.searchParams.append('action', action);
      Object.entries(params).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          url.searchParams.append(key, value);
        }
      });

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        throw new Error(`Serverless API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(`Serverless API error: ${result.error || 'Unknown error'}`);
      }

      console.log('✅ Real Ycharts data received via serverless function');
      return result.data;
      
    } catch (error) {
      console.error('❌ Serverless API request failed:', error);
      
      // Fallback to mock data if serverless fails
      console.log('🔄 Falling back to mock data...');
      return this.getMockData(params.ticker || 'VTSAX');
    }
  }

  // Mock data for development/testing
  getMockData(ticker) {
    // Generate some realistic mock data based on the ticker
    const mockData = {
      ticker: ticker,
      name: `${ticker} Fund`,
      asset_class: 'Large Cap Growth',
      expense_ratio: Math.random() * 0.02 + 0.01, // 1-3%
      ytd_return: (Math.random() - 0.5) * 20, // -10% to +10%
      one_year_return: (Math.random() - 0.5) * 30, // -15% to +15%
      three_year_return: (Math.random() - 0.5) * 40, // -20% to +20%
      five_year_return: (Math.random() - 0.5) * 50, // -25% to +25%
      ten_year_return: (Math.random() - 0.5) * 60, // -30% to +30%
      sharpe_ratio: Math.random() * 2 + 0.5, // 0.5 to 2.5
      standard_deviation: Math.random() * 15 + 10, // 10-25%
      alpha: (Math.random() - 0.5) * 4, // -2 to +2
      beta: Math.random() * 1.5 + 0.5, // 0.5 to 2.0
      manager_tenure: Math.random() * 10 + 2, // 2-12 years
      // NEW FIELDS - Capture ratios (20% of scoring)
      up_capture_ratio: Math.random() * 40 + 80, // 80-120%
      down_capture_ratio: Math.random() * 40 + 80, // 80-120%
      category_rank: Math.floor(Math.random() * 100) + 1, // 1-100
      sec_yield: Math.random() * 5, // 0-5%
      fund_family: 'Mock Fund Family'
    };

    return mockData;
  }

  // Get current fund data by ticker
  async getFundData(ticker) {
    const cacheKey = `fund_${ticker}`;
    const cached = await this.getCachedData(cacheKey);
    if (cached) return cached;

    try {
      const data = await this.makeRequest('/funds', {
        ticker: ticker,
        fields: 'ticker,name,asset_class,expense_ratio,ytd_return,one_year_return,three_year_return,five_year_return,ten_year_return,sharpe_ratio,standard_deviation,alpha,beta,manager_tenure,up_capture_ratio,down_capture_ratio,category_rank,sec_yield,fund_family'
      });

      // Handle different response structures
      let fundData;
      if (data.data) {
        fundData = data.data;
      } else if (Array.isArray(data)) {
        fundData = data[0] || data;
      } else {
        fundData = data;
      }

      // Ensure we have the required fields
      const normalizedData = {
        ticker: fundData.ticker || ticker,
        name: fundData.name || `${ticker} Fund`,
        asset_class: fundData.asset_class || 'Unassigned',
        asset_class_id: null, // may be resolved by service using Supabase
        expense_ratio: fundData.expense_ratio || null,
        ytd_return: fundData.ytd_return || null,
        one_year_return: fundData.one_year_return || null,
        three_year_return: fundData.three_year_return || null,
        five_year_return: fundData.five_year_return || null,
        ten_year_return: fundData.ten_year_return || null,
        sharpe_ratio: fundData.sharpe_ratio || null,
        standard_deviation: fundData.standard_deviation || null,
        alpha: fundData.alpha || null,
        beta: fundData.beta || null,
        manager_tenure: fundData.manager_tenure || null,
        // NEW FIELDS - Capture ratios and additional data
        up_capture_ratio: fundData.up_capture_ratio || null,
        down_capture_ratio: fundData.down_capture_ratio || null,
        category_rank: fundData.category_rank || null,
        sec_yield: fundData.sec_yield || null,
        fund_family: fundData.fund_family || null
      };

      this.setCachedData(cacheKey, normalizedData);
      return normalizedData;
    } catch (error) {
      console.error(`Failed to fetch data for ${ticker}:`, error);
      
      // Return mock data if API fails
      console.log('Returning mock data for:', ticker);
      const mockData = this.getMockData(ticker);
      this.setCachedData(cacheKey, mockData);
      return mockData;
    }
  }

  // Get historical performance data
  async getHistoricalData(ticker, period = '1y') {
    const cacheKey = `historical_${ticker}_${period}`;
    const cached = await this.getCachedData(cacheKey);
    if (cached) return cached;

    try {
      const data = await this.makeRequest('/funds/historical', {
        ticker: ticker,
        period: period
      });

      this.setCachedData(cacheKey, data);
      return data;
    } catch (error) {
      console.error(`Failed to fetch historical data for ${ticker}:`, error);
      return null;
    }
  }

  // Batch update multiple funds
  async batchUpdateFunds(tickers) {
    const results = [];
    const batchSize = 5; // Process in batches to avoid rate limits
    
    for (let i = 0; i < tickers.length; i += batchSize) {
      const batch = tickers.slice(i, i + batchSize);
      const batchPromises = batch.map(ticker => this.getFundData(ticker));
      
      try {
        const batchResults = await Promise.allSettled(batchPromises);
        results.push(...batchResults.map((result, index) => ({
          ticker: batch[index],
          success: result.status === 'fulfilled',
          data: result.status === 'fulfilled' ? result.value : null,
          error: result.status === 'rejected' ? result.reason : null
        })));
      } catch (error) {
        console.error('Batch update failed:', error);
      }
      
      // Add delay between batches
      if (i + batchSize < tickers.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  }

  // Search for funds
  async searchFunds(query) {
    const cacheKey = `search_${query}`;
    const cached = await this.getCachedData(cacheKey);
    if (cached) return cached;

    try {
      const data = await this.makeRequest('/funds/search', {
        query: query,
        limit: 20
      });

      this.setCachedData(cacheKey, data);
      return data;
    } catch (error) {
      console.error(`Failed to search funds for ${query}:`, error);
      return [];
    }
  }

  // Get detailed fund information
  async getFundDetails(ticker) {
    const cacheKey = `details_${ticker}`;
    const cached = await this.getCachedData(cacheKey);
    if (cached) return cached;

    try {
      const data = await this.makeRequest(`/funds/${ticker}`, {
        fields: 'ticker,name,asset_class,expense_ratio,ytd_return,one_year_return,three_year_return,five_year_return,ten_year_return,sharpe_ratio,standard_deviation,alpha,beta,manager_tenure,description,holdings,risk_metrics'
      });

      this.setCachedData(cacheKey, data);
      return data;
    } catch (error) {
      console.error(`Failed to fetch details for ${ticker}:`, error);
      return null;
    }
  }

  // Clear cache for specific ticker or all
  clearCache(ticker = null) {
    if (ticker) {
      const keysToDelete = Array.from(this.cache.keys()).filter(key => key.includes(ticker));
      keysToDelete.forEach(key => this.cache.delete(key));
    } else {
      this.cache.clear();
    }
  }
}

// Create singleton instance
const ychartsAPI = new YchartsAPI(process.env.REACT_APP_YCHARTS_API_KEY);

export default ychartsAPI; 