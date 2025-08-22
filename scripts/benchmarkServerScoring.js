#!/usr/bin/env node

/**
 * Performance benchmark script for server-side scoring
 * Measures response times for calculate_scores_as_of RPC and compares with client-side
 * 
 * Usage: node scripts/benchmarkServerScoring.js [--concurrency=5] [--iterations=10]
 */

import { createClient } from '@supabase/supabase-js';
import { calculateScores } from '../src/services/scoring.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase configuration. Please set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Parse command line arguments
const args = process.argv.slice(2);
let concurrency = 5;
let iterations = 10;

args.forEach(arg => {
  if (arg.startsWith('--concurrency=')) {
    concurrency = parseInt(arg.split('=')[1]);
  } else if (arg.startsWith('--iterations=')) {
    iterations = parseInt(arg.split('=')[1]);
  }
});

console.log(`🚀 Starting server-side scoring performance benchmark...`);
console.log(`   Concurrency: ${concurrency}`);
console.log(`   Iterations: ${iterations}`);

/**
 * Fetch asset class IDs for testing
 */
async function getAssetClassIds() {
  try {
    const { data, error } = await supabase
      .from('asset_classes')
      .select('id, name')
      .order('name');

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('❌ Error fetching asset class IDs:', error);
    throw error;
  }
}

/**
 * Fetch test date (latest available)
 */
async function getTestDate() {
  try {
    const { data, error } = await supabase
      .from('fund_performance')
      .select('date')
      .order('date', { ascending: false })
      .limit(1);

    if (error) throw error;
    return data[0]?.date || '2025-07-31';
  } catch (error) {
    console.error('❌ Error fetching test date:', error);
    return '2025-07-31'; // fallback
  }
}

/**
 * Benchmark server-side scoring RPC
 */
async function benchmarkServerScoring(date, assetClassId) {
  const startTime = Date.now();
  
  try {
    const { data, error } = await supabase.rpc('calculate_scores_as_of', {
      p_date: date,
      p_asset_class_id: assetClassId
    });

    if (error) throw error;
    
    const duration = Date.now() - startTime;
    return {
      success: true,
      duration,
      fundCount: data?.length || 0,
      error: null
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      success: false,
      duration,
      fundCount: 0,
      error: error.message
    };
  }
}

/**
 * Benchmark client-side scoring
 */
async function benchmarkClientScoring(date, assetClassId) {
  const startTime = Date.now();
  
  try {
    // Fetch funds data
    const { data: funds, error } = await supabase
      .from('funds')
      .select(`
        *,
        asset_classes!inner(name),
        fund_performance!inner(
          date,
          ytd_return,
          one_year_return,
          three_year_return,
          five_year_return,
          ten_year_return,
          sharpe_ratio,
          standard_deviation_3y,
          standard_deviation_5y,
          expense_ratio,
          beta,
          alpha,
          up_capture_ratio,
          down_capture_ratio,
          manager_tenure
        )
      `)
      .eq('asset_class_id', assetClassId)
      .eq('fund_performance.date', date);

    if (error) throw error;

    // Transform data
    const transformedFunds = funds.map(fund => {
      const perf = fund.fund_performance[0] || {};
      return {
        id: fund.id,
        ticker: fund.ticker,
        name: fund.name,
        asset_class_id: fund.asset_class_id,
        asset_class_name: fund.asset_classes?.name || 'Unknown',
        isBenchmark: fund.is_benchmark || false,
        isRecommended: fund.is_recommended || false,
        ytd_return: perf.ytd_return,
        one_year_return: perf.one_year_return,
        three_year_return: perf.three_year_return,
        five_year_return: perf.five_year_return,
        ten_year_return: perf.ten_year_return,
        sharpe_ratio: perf.sharpe_ratio,
        standard_deviation_3y: perf.standard_deviation_3y,
        standard_deviation_5y: perf.standard_deviation_5y,
        expense_ratio: perf.expense_ratio,
        beta: perf.beta,
        alpha: perf.alpha,
        up_capture_ratio: perf.up_capture_ratio,
        down_capture_ratio: perf.down_capture_ratio,
        manager_tenure: perf.manager_tenure
      };
    });

    // Calculate scores
    const scores = calculateScores(transformedFunds);
    
    const duration = Date.now() - startTime;
    return {
      success: true,
      duration,
      fundCount: scores?.length || 0,
      error: null
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      success: false,
      duration,
      fundCount: 0,
      error: error.message
    };
  }
}

/**
 * Run concurrent benchmarks
 */
async function runConcurrentBenchmarks(benchmarkFn, date, assetClassIds, concurrency, iterations) {
  const results = [];
  
  for (let i = 0; i < iterations; i++) {
    const batchPromises = [];
    
    for (let j = 0; j < concurrency; j++) {
      const assetClassId = assetClassIds[j % assetClassIds.length];
      batchPromises.push(benchmarkFn(date, assetClassId));
    }
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Small delay between batches
    if (i < iterations - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return results;
}

/**
 * Calculate statistics from benchmark results
 */
function calculateStats(results) {
  const successful = results.filter(r => r.success);
  const durations = successful.map(r => r.duration);
  
  if (durations.length === 0) {
    return {
      total: results.length,
      successful: 0,
      failed: results.length,
      avgDuration: 0,
      minDuration: 0,
      maxDuration: 0,
      p50: 0,
      p95: 0,
      p99: 0
    };
  }
  
  durations.sort((a, b) => a - b);
  const n = durations.length;
  
  return {
    total: results.length,
    successful: successful.length,
    failed: results.length - successful.length,
    avgDuration: durations.reduce((a, b) => a + b, 0) / n,
    minDuration: durations[0],
    maxDuration: durations[n - 1],
    p50: durations[Math.floor(n * 0.5)],
    p95: durations[Math.floor(n * 0.95)],
    p99: durations[Math.floor(n * 0.99)]
  };
}

/**
 * Generate benchmark report
 */
function generateReport(serverStats, clientStats, assetClassIds, date) {
  console.log('\n📊 PERFORMANCE BENCHMARK REPORT');
  console.log('='.repeat(60));
  console.log(`📅 Test Date: ${date}`);
  console.log(`🏢 Asset Classes: ${assetClassIds.length}`);
  console.log(`🔄 Concurrency: ${concurrency}`);
  console.log(`📈 Iterations: ${iterations}`);
  console.log(`📊 Total Requests: ${concurrency * iterations}`);
  
  console.log('\n🖥️  SERVER-SIDE SCORING:');
  console.log(`   Total: ${serverStats.total}`);
  console.log(`   Successful: ${serverStats.successful}`);
  console.log(`   Failed: ${serverStats.failed}`);
  console.log(`   Success Rate: ${((serverStats.successful / serverStats.total) * 100).toFixed(1)}%`);
  console.log(`   Average: ${serverStats.avgDuration.toFixed(1)}ms`);
  console.log(`   Min: ${serverStats.minDuration}ms`);
  console.log(`   Max: ${serverStats.maxDuration}ms`);
  console.log(`   P50: ${serverStats.p50}ms`);
  console.log(`   P95: ${serverStats.p95}ms`);
  console.log(`   P99: ${serverStats.p99}ms`);
  
  console.log('\n🧮 CLIENT-SIDE SCORING:');
  console.log(`   Total: ${clientStats.total}`);
  console.log(`   Successful: ${clientStats.successful}`);
  console.log(`   Failed: ${clientStats.failed}`);
  console.log(`   Success Rate: ${((clientStats.successful / clientStats.total) * 100).toFixed(1)}%`);
  console.log(`   Average: ${clientStats.avgDuration.toFixed(1)}ms`);
  console.log(`   Min: ${clientStats.minDuration}ms`);
  console.log(`   Max: ${clientStats.maxDuration}ms`);
  console.log(`   P50: ${clientStats.p50}ms`);
  console.log(`   P99: ${clientStats.p99}ms`);
  
  // Performance comparison
  if (serverStats.successful > 0 && clientStats.successful > 0) {
    const speedup = clientStats.avgDuration / serverStats.avgDuration;
    console.log('\n⚡ PERFORMANCE COMPARISON:');
    console.log(`   Server vs Client Speedup: ${speedup.toFixed(2)}x`);
    console.log(`   Server P95: ${serverStats.p95}ms (Target: <500ms)`);
    console.log(`   Server P99: ${serverStats.p99}ms (Target: <1000ms)`);
    
    // Check performance targets
    const p95Pass = serverStats.p95 < 500;
    const p99Pass = serverStats.p99 < 1000;
    
    if (p95Pass && p99Pass) {
      console.log('\n✅ PERFORMANCE TARGETS MET');
    } else {
      console.log('\n⚠️  PERFORMANCE TARGETS NOT MET');
      if (!p95Pass) console.log(`   P95 target missed: ${serverStats.p95}ms > 500ms`);
      if (!p99Pass) console.log(`   P99 target missed: ${serverStats.p99}ms > 1000ms`);
    }
  }
  
  // Success rate analysis
  if (serverStats.successful < serverStats.total) {
    console.log('\n❌ SERVER-SIDE SCORING ERRORS:');
    console.log(`   ${serverStats.failed} out of ${serverStats.total} requests failed`);
    console.log(`   Success rate: ${((serverStats.successful / serverStats.total) * 100).toFixed(1)}%`);
  }
}

/**
 * Main benchmark function
 */
async function runBenchmarks() {
  try {
    console.log('📥 Fetching asset class IDs...');
    const assetClassIds = await getAssetClassIds();
    console.log(`   Found ${assetClassIds.length} asset classes`);
    
    console.log('\n📅 Getting test date...');
    const testDate = await getTestDate();
    console.log(`   Using date: ${testDate}`);
    
    if (assetClassIds.length === 0) {
      console.log('❌ No asset classes found');
      return;
    }
    
    console.log('\n🖥️  Benchmarking server-side scoring...');
    const serverResults = await runConcurrentBenchmarks(
      benchmarkServerScoring,
      testDate,
      assetClassIds,
      concurrency,
      iterations
    );
    
    console.log('🧮 Benchmarking client-side scoring...');
    const clientResults = await runConcurrentBenchmarks(
      benchmarkClientScoring,
      testDate,
      assetClassIds,
      concurrency,
      iterations
    );
    
    console.log('\n📊 Calculating statistics...');
    const serverStats = calculateStats(serverResults);
    const clientStats = calculateStats(clientResults);
    
    // Generate report
    generateReport(serverStats, clientStats, assetClassIds, testDate);
    
    // Exit with appropriate code
    const serverSuccessRate = serverStats.successful / serverStats.total;
    const p95Pass = serverStats.p95 < 500;
    const p99Pass = serverStats.p99 < 1000;
    
    if (serverSuccessRate >= 0.95 && p95Pass && p99Pass) {
      console.log('\n✅ BENCHMARK PASSED');
      process.exit(0);
    } else {
      console.log('\n❌ BENCHMARK FAILED');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n💥 Benchmark failed with error:', error);
    process.exit(1);
  }
}

// Run benchmarks if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runBenchmarks();
}

export { runBenchmarks }; 