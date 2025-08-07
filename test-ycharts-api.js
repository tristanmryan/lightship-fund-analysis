// test-ycharts-api.js - Test the updated YCharts API integration
// Run with: node test-ycharts-api.js

// Import our serverless function handler
import handler from './api/ycharts.js';

// Mock request and response objects
function createMockReq(query) {
  return {
    method: 'GET',
    query: query,
    headers: {
      origin: 'http://localhost:3000'
    }
  };
}

function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    
    status(code) {
      this.statusCode = code;
      return this;
    },
    
    json(data) {
      this.body = JSON.stringify(data);
      console.log(`Response ${this.statusCode}:`, JSON.stringify(data, null, 2));
      return this;
    },
    
    setHeader(key, value) {
      this.headers[key] = value;
      return this;
    },
    
    end() {
      console.log('Response ended');
      return this;
    }
  };
  
  return res;
}

// Test different security types
async function testYChartsAPI() {
  console.log('🧪 Testing YCharts API Integration...\n');

  // Test 1: Mutual Fund (VTSAX)
  console.log('📊 Test 1: Mutual Fund (VTSAX)');
  const req1 = createMockReq({ action: 'getFundData', ticker: 'VTSAX' });
  const res1 = createMockRes();
  await handler(req1, res1);
  console.log('\n');

  // Test 2: ETF (SPY)
  console.log('📊 Test 2: ETF (SPY)');
  const req2 = createMockReq({ action: 'getFundData', ticker: 'SPY' });
  const res2 = createMockRes();
  await handler(req2, res2);
  console.log('\n');

  // Test 3: Stock (AAPL)
  console.log('📊 Test 3: Stock (AAPL)');
  const req3 = createMockReq({ action: 'getFundData', ticker: 'AAPL' });
  const res3 = createMockRes();
  await handler(req3, res3);
  console.log('\n');

  console.log('✅ YCharts API tests completed!');
}

// Set environment variables for testing
process.env.YCHARTS_API_KEY = 'test-api-key';
process.env.NODE_ENV = 'production';

// Run tests
testYChartsAPI().catch(console.error);