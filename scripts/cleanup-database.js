// scripts/cleanup-database.js
// Comprehensive database cleanup script for RJFA funds

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      process.env[key] = value;
    }
  });
}

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Required: REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanupDatabase() {
  console.log('🧹 Starting comprehensive database cleanup...');
  console.log('🕐 Cleanup started at:', new Date().toISOString());
  
  try {
    // Step 1: Check current state
    console.log('\n📊 Step 1: Checking current database state...');
    
    const { data: allFunds, error: fundsError } = await supabase
      .from('funds')
      .select('ticker, name, created_at')
      .order('ticker');
    
    if (fundsError) {
      console.error('❌ Error fetching funds:', fundsError.message);
      return;
    }
    
    const { data: allPerformance, error: perfError } = await supabase
      .from('fund_performance')
      .select('fund_ticker, date')
      .order('fund_ticker');
    
    if (perfError) {
      console.error('❌ Error fetching performance data:', perfError.message);
      return;
    }
    
    const { data: allBenchmarks, error: benchError } = await supabase
      .from('benchmarks')
      .select('ticker, name, created_at')
      .order('ticker');
    
    if (benchError) {
      console.error('❌ Error fetching benchmarks:', benchError.message);
      return;
    }
    
    const { data: allBenchmarkPerformance, error: benchPerfError } = await supabase
      .from('benchmark_performance')
      .select('benchmark_ticker, date')
      .order('benchmark_ticker');
    
    if (benchPerfError) {
      console.error('❌ Error fetching benchmark performance data:', benchPerfError.message);
      return;
    }
    
    console.log(`   • Total funds: ${allFunds?.length || 0}`);
    console.log(`   • Total performance records: ${allPerformance?.length || 0}`);
    console.log(`   • Total benchmarks: ${allBenchmarks?.length || 0}`);
    console.log(`   • Total benchmark performance records: ${allBenchmarkPerformance?.length || 0}`);
    
    // Analyze fund types
    const rjfaFunds = allFunds?.filter(f => f.ticker.startsWith('RJFA')) || [];
    const rjxFunds = allFunds?.filter(f => f.ticker.startsWith('RJX')) || [];
    const otherFunds = allFunds?.filter(f => !f.ticker.startsWith('RJFA') && !f.ticker.startsWith('RJX')) || [];
    
    console.log(`   • RJFA funds: ${rjfaFunds.length}`);
    console.log(`   • RJX funds: ${rjxFunds.length}`);
    console.log(`   • Other funds: ${otherFunds.length}`);
    
    if (otherFunds.length > 0) {
      console.log(`   • Other fund examples: ${otherFunds.slice(0, 5).map(f => f.ticker).join(', ')}${otherFunds.length > 5 ? '...' : ''}`);
    }
    
    // Step 2: Clean up non-RJFA funds
    console.log('\n🗑️ Step 2: Cleaning up non-RJFA funds...');
    
    if (otherFunds.length > 0) {
      const otherTickers = otherFunds.map(f => f.ticker);
      console.log(`   • Deleting ${otherFunds.length} non-RJFA funds...`);
      
      const { error: deleteFundsError } = await supabase
        .from('funds')
        .delete()
        .in('ticker', otherTickers);
      
      if (deleteFundsError) {
        console.error('❌ Error deleting non-RJFA funds:', deleteFundsError.message);
      } else {
        console.log(`✅ Successfully deleted ${otherFunds.length} non-RJFA funds`);
      }
    } else {
      console.log('   • No non-RJFA funds to delete');
    }
    
    // Step 3: Clean up RJX funds (benchmark testing)
    console.log('\n🗑️ Step 3: Cleaning up RJX funds (benchmark testing)...');
    
    if (rjxFunds.length > 0) {
      const rjxTickers = rjxFunds.map(f => f.ticker);
      console.log(`   • Deleting ${rjxFunds.length} RJX funds...`);
      
      const { error: deleteRjxError } = await supabase
        .from('funds')
        .delete()
        .in('ticker', rjxTickers);
      
      if (deleteRjxError) {
        console.error('❌ Error deleting RJX funds:', deleteRjxError.message);
      } else {
        console.log(`✅ Successfully deleted ${rjxFunds.length} RJX funds`);
      }
    } else {
      console.log('   • No RJX funds to delete');
    }
    
    // Step 4: Clean up performance data for deleted funds
    console.log('\n🗑️ Step 4: Cleaning up performance data for deleted funds...');
    
    const deletedTickers = [...(otherFunds.map(f => f.ticker)), ...(rjxFunds.map(f => f.ticker))];
    
    if (deletedTickers.length > 0) {
      console.log(`   • Deleting performance data for ${deletedTickers.length} deleted funds...`);
      
      const { error: deletePerfError } = await supabase
        .from('fund_performance')
        .delete()
        .in('fund_ticker', deletedTickers);
      
      if (deletePerfError) {
        console.error('❌ Error deleting performance data:', deletePerfError.message);
      } else {
        console.log(`✅ Successfully deleted performance data for deleted funds`);
      }
    } else {
      console.log('   • No performance data to delete');
    }
    
    // Step 5: Clean up all performance data for fresh seeding
    console.log('\n🗑️ Step 5: Cleaning up all performance data for fresh seeding...');
    
    const { error: deleteAllPerfError } = await supabase
      .from('fund_performance')
      .delete()
      .neq('fund_ticker', 'dummy'); // Delete all records
    
    if (deleteAllPerfError) {
      console.error('❌ Error deleting all performance data:', deleteAllPerfError.message);
    } else {
      console.log(`✅ Successfully deleted all performance data for fresh seeding`);
    }
    
    // Step 6: Clean up all benchmark performance data
    console.log('\n🗑️ Step 6: Cleaning up all benchmark performance data...');
    
    const { error: deleteAllBenchPerfError } = await supabase
      .from('benchmark_performance')
      .delete()
      .neq('benchmark_ticker', 'dummy'); // Delete all records
    
    if (deleteAllBenchPerfError) {
      console.error('❌ Error deleting all benchmark performance data:', deleteAllBenchPerfError.message);
    } else {
      console.log(`✅ Successfully deleted all benchmark performance data for fresh seeding`);
    }
    
    // Step 7: Clean up all benchmarks for fresh seeding
    console.log('\n🗑️ Step 7: Cleaning up all benchmarks for fresh seeding...');
    
    const { error: deleteAllBenchError } = await supabase
      .from('benchmarks')
      .delete()
      .neq('ticker', 'dummy'); // Delete all records
    
    if (deleteAllBenchError) {
      console.error('❌ Error deleting all benchmarks:', deleteAllBenchError.message);
    } else {
      console.log(`✅ Successfully deleted all benchmarks for fresh seeding`);
    }
    
    // Step 8: Verify cleanup
    console.log('\n🔍 Step 8: Verifying cleanup...');
    
    const { data: remainingFunds, error: remainingFundsError } = await supabase
      .from('funds')
      .select('ticker, name, is_recommended')
      .order('ticker');
    
    if (remainingFundsError) {
      console.error('❌ Error fetching remaining funds:', remainingFundsError.message);
      return;
    }
    
    const { data: remainingPerformance, error: remainingPerfError } = await supabase
      .from('fund_performance')
      .select('fund_ticker, date')
      .order('fund_ticker');
    
    if (remainingPerfError) {
      console.error('❌ Error fetching remaining performance data:', remainingPerfError.message);
      return;
    }
    
    const { data: remainingBenchmarks, error: remainingBenchError } = await supabase
      .from('benchmarks')
      .select('ticker, name')
      .order('ticker');
    
    if (remainingBenchError) {
      console.error('❌ Error fetching remaining benchmarks:', remainingBenchError.message);
      return;
    }
    
    const { data: remainingBenchPerformance, error: remainingBenchPerfError } = await supabase
      .from('benchmark_performance')
      .select('benchmark_ticker, date')
      .order('benchmark_ticker');
    
    if (remainingBenchPerfError) {
      console.error('❌ Error fetching remaining benchmark performance data:', remainingBenchPerfError.message);
      return;
    }
    
    console.log(`   • Remaining funds: ${remainingFunds?.length || 0}`);
    console.log(`   • Remaining performance records: ${remainingPerformance?.length || 0}`);
    console.log(`   • Remaining benchmarks: ${remainingBenchmarks?.length || 0}`);
    console.log(`   • Remaining benchmark performance records: ${remainingBenchPerformance?.length || 0}`);
    
    if (remainingFunds) {
      const tickers = remainingFunds.map(f => f.ticker);
      const recommendedCount = remainingFunds.filter(f => f.is_recommended).length;
      
      console.log(`   • Fund tickers: ${tickers.slice(0, 10).join(', ')}${tickers.length > 10 ? '...' : ''}`);
      console.log(`   • Recommended funds: ${recommendedCount}`);
      
      // Check if we have exactly 120 RJFA funds
      const rjfaCount = tickers.filter(t => t.startsWith('RJFA')).length;
      if (rjfaCount === 120) {
        console.log(`✅ Perfect! Exactly ${rjfaCount} RJFA funds remaining`);
      } else {
        console.log(`⚠️ Expected 120 RJFA funds, found ${rjfaCount}`);
      }
    }
    
    console.log('\n✅ Database cleanup completed successfully!');
    console.log('📅 Cleanup completed at:', new Date().toISOString());
    console.log('🎯 Database is now ready for fresh seeding');
    
  } catch (error) {
    console.error('❌ Database cleanup failed:', error.message);
    console.error('❌ Error type:', error.constructor.name);
    console.error('❌ Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the cleanup
cleanupDatabase().then(() => {
  console.log('\n🏁 Cleanup script completed successfully');
  process.exit(0);
}).catch((error) => {
  console.error('\n💥 Cleanup script crashed:', error);
  process.exit(1);
}); 