// seeds/verify.js
// Verification script for Sprint 0 baseline environment

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env file if it exists
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

// Supabase connection
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  console.error('Required: REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Expected counts
const EXPECTED = {
  ASSET_CLASSES: 32,
  BENCHMARKS: 28,
  FUNDS: 120,
  PERFORMANCE_RECORDS: 120 * 12, // 120 funds × 12 months
  RECOMMENDED_FUNDS: 20,
  EOM_MONTHS: 12
};

// Verification checks
const checks = [];

function addCheck(name, expected, actual, status = null) {
  if (status === null) {
    status = expected === actual ? '✅' : '❌';
  }
  checks.push({ name, expected, actual, status });
}

async function verifyDatabase() {
  console.log('🔍 Verifying database seeding...\n');
  
  try {
    // 1. Check Asset Classes
    const { data: assetClasses, error: acError } = await supabase
      .from('asset_classes')
      .select('*');
    
    if (acError) throw new Error(`Asset classes query error: ${acError.message}`);
    
    addCheck('Asset Classes Count', EXPECTED.ASSET_CLASSES, assetClasses?.length || 0);
    
    // Check that all have required fields
    const validACs = assetClasses?.filter(ac => ac.name && ac.code)?.length || 0;
    addCheck('Valid Asset Classes (name+code)', EXPECTED.ASSET_CLASSES, validACs);
    
    // 2. Check Benchmarks
    const { data: benchmarks, error: benchError } = await supabase
      .from('benchmarks')
      .select('*');
    
    if (benchError) throw new Error(`Benchmarks query error: ${benchError.message}`);
    
    addCheck('Benchmarks Count', EXPECTED.BENCHMARKS, benchmarks?.length || 0);
    
    const validBenchs = benchmarks?.filter(b => b.ticker && b.name)?.length || 0;
    addCheck('Valid Benchmarks (ticker+name)', EXPECTED.BENCHMARKS, validBenchs);
    
    // 3. Check Asset Class Benchmark assignments
    const { data: acbLinks, error: acbError } = await supabase
      .from('asset_class_benchmarks')
      .select('*');
    
    if (acbError) throw new Error(`Asset class benchmarks query error: ${acbError.message}`);
    
    addCheck('Primary Benchmark Assignments', EXPECTED.BENCHMARKS, acbLinks?.length || 0);
    
    // Check all are primary type
    const primaryLinks = acbLinks?.filter(link => link.kind === 'primary')?.length || 0;
    addCheck('Primary Kind Assignments', EXPECTED.BENCHMARKS, primaryLinks);
    
    // 4. Check Funds
    const { data: funds, error: fundError } = await supabase
      .from('funds')
      .select('*');
    
    if (fundError) throw new Error(`Funds query error: ${fundError.message}`);
    
    addCheck('Funds Count', EXPECTED.FUNDS, funds?.length || 0);
    
    // Check recommended funds
    const recommendedFunds = funds?.filter(f => f.is_recommended)?.length || 0;
    addCheck('Recommended Funds', EXPECTED.RECOMMENDED_FUNDS, recommendedFunds);
    
    // Check fund ticker pattern (RJFA001-RJFA120)
    const validTickers = funds?.filter(f => /^RJFA\d{3}$/.test(f.ticker))?.length || 0;
    addCheck('Valid Fund Tickers (RJFA###)', EXPECTED.FUNDS, validTickers);
    
    // Check asset class assignments
    const fundsWithAssetClass = funds?.filter(f => f.asset_class_id)?.length || 0;
    addCheck('Funds with Asset Class ID', EXPECTED.FUNDS, fundsWithAssetClass);
    
    // 5. Check Performance Data
    const { data: performance, error: perfError } = await supabase
      .from('fund_performance')
      .select('*');
    
    if (perfError) throw new Error(`Performance query error: ${perfError.message}`);
    
    addCheck('Performance Records', EXPECTED.PERFORMANCE_RECORDS, performance?.length || 0);
    
    // Check date range
    const dates = performance?.map(p => p.date).filter(Boolean) || [];
    const uniqueDates = [...new Set(dates)].sort();
    addCheck('Unique Performance Dates', EXPECTED.EOM_MONTHS, uniqueDates.length);
    
    // Check date range bounds
    if (uniqueDates.length > 0) {
      const firstDate = uniqueDates[0];
      const lastDate = uniqueDates[uniqueDates.length - 1];
      
      const expectedFirst = '2024-08-31';
      const expectedLast = '2025-07-31';
      
      addCheck('First Performance Date', expectedFirst, firstDate, firstDate === expectedFirst ? '✅' : '❌');
      addCheck('Last Performance Date', expectedLast, lastDate, lastDate === expectedLast ? '✅' : '❌');
    }
    
    // Check that all funds have performance data
    const fundsWithPerformance = [...new Set(performance?.map(p => p.fund_ticker))].length;
    addCheck('Funds with Performance Data', EXPECTED.FUNDS, fundsWithPerformance);
    
    // 6. Check specific fund data quality
    const samplePerf = performance?.slice(0, 5) || [];
    let validMetrics = 0;
    
    samplePerf.forEach(perf => {
      if (perf.ytd_return !== null && perf.one_year_return !== null && 
          perf.sharpe_ratio !== null && perf.expense_ratio !== null) {
        validMetrics++;
      }
    });
    
    addCheck('Sample Records with Valid Metrics', Math.min(5, samplePerf.length), validMetrics);
    
    // 7. Test RPCs (basic connectivity)
    try {
      const { data: rpcTest, error: rpcError } = await supabase
        .rpc('get_active_month');
      
      if (rpcError) {
        addCheck('RPC Connectivity (get_active_month)', 'Success', 'Failed', '❌');
      } else {
        addCheck('RPC Connectivity (get_active_month)', 'Success', 'Success', '✅');
      }
    } catch (error) {
      addCheck('RPC Connectivity (get_active_month)', 'Success', 'Failed', '❌');
    }
    
    // Display results
    console.log('📋 Verification Results:\n');
    
    let allPassed = true;
    checks.forEach(check => {
      const status = check.status === '✅' ? 'PASS' : 'FAIL';
      console.log(`${check.status} ${check.name}: ${check.actual} (expected: ${check.expected}) [${status}]`);
      
      if (check.status === '❌') {
        allPassed = false;
      }
    });
    
    console.log('\n' + '='.repeat(60));
    
    if (allPassed) {
      console.log('🎉 ✅ All checks passed! Database is properly seeded.');
      console.log('\n📊 Summary:');
      console.log(`   • ${checks.filter(c => c.status === '✅').length}/${checks.length} checks passed`);
      console.log(`   • Ready for benchmarking with npm run bench`);
    } else {
      const failedChecks = checks.filter(c => c.status === '❌');
      console.log(`❌ ${failedChecks.length} checks failed. Review the issues above.`);
      console.log('\n🔧 Failed checks:');
      failedChecks.forEach(check => {
        console.log(`   • ${check.name}: got ${check.actual}, expected ${check.expected}`);
      });
      console.log('\n💡 Try running: npm run seed');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    process.exit(1);
  }
}

// Run verification
if (require.main === module) {
  verifyDatabase();
}

module.exports = { verifyDatabase };