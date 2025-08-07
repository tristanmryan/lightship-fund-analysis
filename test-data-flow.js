// Test script to verify complete data flow with performance data
import fundService from './src/services/fundService.js';
import ychartsAPI from './src/services/ychartsAPI.js';

async function testDataFlow() {
  console.log('🧪 Testing Complete Data Flow with Performance Data...');
  
  try {
    // Test 1: Add a fund with performance data
    console.log('\n📊 Test 1: Adding fund with performance data...');
    
    const testTicker = 'VTSAX';
    const testAssetClass = 'Large Cap Growth';
    
    console.log(`Adding fund: ${testTicker}`);
    
    // Get data from API (will be mock data in development)
    const apiData = await ychartsAPI.getFundData(testTicker);
    console.log('API data received:', {
      ticker: apiData.ticker,
      name: apiData.name,
      asset_class: apiData.asset_class,
      ytd_return: apiData.ytd_return,
      expense_ratio: apiData.expense_ratio
    });

    // Save fund to database
    const fundData = {
      ticker: testTicker,
      name: apiData.name,
      asset_class: testAssetClass,
      is_recommended: false
    };
    
    const savedFund = await fundService.saveFund(fundData);
    console.log('Fund saved to database:', savedFund);

    // Save performance data
    const performanceData = {
      ticker: testTicker,
      date: new Date(),
      ytd_return: apiData.ytd_return,
      one_year_return: apiData.one_year_return,
      three_year_return: apiData.three_year_return,
      five_year_return: apiData.five_year_return,
      ten_year_return: apiData.ten_year_return,
      sharpe_ratio: apiData.sharpe_ratio,
      standard_deviation: apiData.standard_deviation,
      expense_ratio: apiData.expense_ratio,
      alpha: apiData.alpha,
      beta: apiData.beta,
      manager_tenure: apiData.manager_tenure
    };
    
    const savedPerformance = await fundService.saveFundPerformance(performanceData);
    console.log('Performance data saved:', savedPerformance);

    // Test 2: Retrieve funds with performance data
    console.log('\n📊 Test 2: Testing retrieval with performance data...');
    
    const allFunds = await fundService.getAllFunds();
    console.log(`Total funds in database: ${allFunds.length}`);
    
    if (allFunds.length > 0) {
      const firstFund = allFunds[0];
      console.log('First fund with performance data:', {
        ticker: firstFund.ticker,
        name: firstFund.name,
        asset_class: firstFund.asset_class,
        ytd_return: firstFund.ytd_return,
        one_year_return: firstFund.one_year_return,
        expense_ratio: firstFund.expense_ratio,
        sharpe_ratio: firstFund.sharpe_ratio
      });
    }

    // Test 3: Test individual fund retrieval
    console.log('\n📊 Test 3: Testing individual fund retrieval...');
    
    const retrievedFund = await fundService.getFund(testTicker);
    console.log('Retrieved fund:', retrievedFund);
    
    const retrievedPerformance = await fundService.getFundPerformance(testTicker);
    console.log('Retrieved performance:', retrievedPerformance);

    // Test 4: Test batch update
    console.log('\n📊 Test 4: Testing batch update...');
    
    const updateResults = await fundService.batchUpdateFromAPI([testTicker]);
    console.log('Batch update results:', updateResults);

    console.log('\n✅ Data flow tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Data flow test failed:', error);
  }
}

// Run the test
testDataFlow(); 