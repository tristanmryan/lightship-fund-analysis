// Validation script to check if real data was imported correctly
import { supabase, TABLES } from '../services/supabase.js';

async function validateRealDataImport() {
  console.log('🔍 Validating real data import...');
  
  try {
    // Count benchmarks
    const { count: benchmarkCount, error: benchError } = await supabase
      .from(TABLES.BENCHMARKS)
      .select('*', { count: 'exact' });
    
    if (benchError) {
      console.error('Error counting benchmarks:', benchError);
      return false;
    }

    // Count recommended funds
    const { count: recFundCount, error: recError } = await supabase
      .from(TABLES.FUNDS)
      .select('*', { count: 'exact' })
      .eq('is_recommended', true);
    
    if (recError) {
      console.error('Error counting recommended funds:', recError);
      return false;
    }

    // Count non-recommended funds
    const { count: nonRecFundCount, error: nonRecError } = await supabase
      .from(TABLES.FUNDS)
      .select('*', { count: 'exact' })
      .eq('is_recommended', false);
    
    if (nonRecError) {
      console.error('Error counting non-recommended funds:', nonRecError);
      return false;
    }

    // Count asset class mappings
    const { count: mappingCount, error: mappingError } = await supabase
      .from(TABLES.ASSET_CLASS_BENCHMARKS)
      .select('*', { count: 'exact' });
    
    if (mappingError) {
      console.error('Error counting asset class mappings:', mappingError);
      return false;
    }

    // Sample some actual data
    const { data: sampleBenchmarks } = await supabase
      .from(TABLES.BENCHMARKS)
      .select('ticker, name')
      .limit(5);

    const { data: sampleRecFunds } = await supabase
      .from(TABLES.FUNDS)
      .select('ticker, name, asset_class')
      .eq('is_recommended', true)
      .limit(5);

    const { data: sampleNonRecFunds } = await supabase
      .from(TABLES.FUNDS)
      .select('ticker, name, asset_class')
      .eq('is_recommended', false)
      .limit(5);

    // Report results
    console.log('\n📊 Import Validation Results:');
    console.log(`  Unique Benchmarks: ${benchmarkCount} (expected: 20+)`);
    console.log(`  Asset Class Mappings: ${mappingCount} (expected: 32)`);
    console.log(`  Recommended funds: ${recFundCount} (expected: 107)`);
    console.log(`  Non-recommended funds: ${nonRecFundCount} (expected: 42)`);
    console.log(`  Total funds: ${recFundCount + nonRecFundCount} (expected: 149)`);

        // Expected counts
    const expectedRecFunds = 107;
    const expectedNonRecFunds = 42;
    const expectedTotalFunds = 149;
    
    // For benchmarks, we expect fewer unique benchmarks than CSV rows due to duplicates
    // but we should have at least 20 unique benchmarks and 32 total mappings
    const expectedMinBenchmarks = 20;
    const expectedMappings = 32;
    
    const success = (
      benchmarkCount >= expectedMinBenchmarks &&
      mappingCount >= expectedMappings &&
      recFundCount === expectedRecFunds &&
      nonRecFundCount === expectedNonRecFunds &&
      (recFundCount + nonRecFundCount) === expectedTotalFunds
    );

    console.log('\n✅ Validation Status:', success ? 'PASSED' : 'FAILED');

    if (success) {
      console.log('\n🎯 Real data import is complete and validated!');
      console.log('   Professional launch data is ready.');
    } else {
      console.log('\n⚠️  Import counts do not match expected values.');
      console.log('   Please check the import process for errors.');
    }

    // Show sample data
    console.log('\n📋 Sample Data:');
    
    console.log('\n  Benchmarks:');
    sampleBenchmarks?.forEach(b => {
      console.log(`    ${b.ticker}: ${b.name}`);
    });

    console.log('\n  Recommended Funds:');
    sampleRecFunds?.forEach(f => {
      console.log(`    ${f.ticker}: ${f.name} (${f.asset_class})`);
    });

    console.log('\n  Non-Recommended Funds:');
    sampleNonRecFunds?.forEach(f => {
      console.log(`    ${f.ticker}: ${f.name} (${f.asset_class})`);
    });

    return success;

  } catch (error) {
    console.error('❌ Fatal error during validation:', error);
    return false;
  }
}

// Function to check if the app is using real data vs sample data
async function checkDataType() {
  try {
    // Look for known sample fund tickers vs real fund tickers
    const { data: funds } = await supabase
      .from(TABLES.FUNDS)
      .select('ticker, name')
      .limit(10);

    const fundTickers = (funds || []).map(f => f.ticker);
    
    // Sample data typically includes tickers like RJFA*, RJFB*, etc.
    const hasSampleData = fundTickers.some(ticker => ticker?.startsWith('RJF'));
    
    // Real data should include actual fund tickers from our CSV
    const realDataTickers = ['CAIFX', 'PRWCX', 'TIBIX', 'WMFFX', 'FZANX'];
    const hasRealData = realDataTickers.some(ticker => fundTickers.includes(ticker));

    console.log('\n🔍 Data Type Detection:');
    console.log(`  Contains sample data: ${hasSampleData ? 'YES' : 'NO'}`);
    console.log(`  Contains real data: ${hasRealData ? 'YES' : 'NO'}`);
    
    if (hasRealData && !hasSampleData) {
      console.log('✅ App is using REAL fund data');
    } else if (hasSampleData && !hasRealData) {
      console.log('ℹ️  App is using SAMPLE data');
    } else {
      console.log('⚠️  App contains MIXED data (real + sample)');
    }

    return hasRealData;

  } catch (error) {
    console.error('Error checking data type:', error);
    return false;
  }
}

// Export functions
export { validateRealDataImport, checkDataType };

// If run directly (for Node.js environment)
if (typeof process !== 'undefined' && process.argv) {
  validateRealDataImport()
    .then((success) => {
      console.log(`\n🏁 Validation ${success ? 'PASSED' : 'FAILED'}`);
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}