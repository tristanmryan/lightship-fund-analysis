// Test script to verify API integration
const ychartsAPI = require('./src/services/ychartsAPI.js').default;

async function testAPIIntegration() {
  console.log('🧪 Testing API Integration...');
  
  try {
    // Test 1: Get fund data for a known ticker
    console.log('\n📊 Test 1: Fetching fund data for VTSAX...');
    const fundData = await ychartsAPI.getFundData('VTSAX');
    console.log('Fund data received:', {
      ticker: fundData.ticker,
      name: fundData.name,
      asset_class: fundData.asset_class,
      ytd_return: fundData.ytd_return,
      expense_ratio: fundData.expense_ratio
    });

    // Test 2: Test batch update
    console.log('\n📊 Test 2: Testing batch update for multiple funds...');
    const batchResults = await ychartsAPI.batchUpdateFunds(['VTSAX', 'SPY', 'IWF']);
    console.log('Batch update results:', batchResults.map(r => ({
      ticker: r.ticker,
      success: r.success,
      hasData: !!r.data
    })));

    // Test 3: Test search functionality
    console.log('\n📊 Test 3: Testing fund search...');
    const searchResults = await ychartsAPI.searchFunds('VTSAX');
    console.log('Search results count:', searchResults.length);

    console.log('\n✅ API Integration tests completed successfully!');
    
  } catch (error) {
    console.error('❌ API Integration test failed:', error);
  }
}

// Run the test
testAPIIntegration(); 