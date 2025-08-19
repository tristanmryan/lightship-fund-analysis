// bench/bench.js
// Benchmark harness for Sprint 0 RPC performance testing

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

// Supabase connection
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Parse command line arguments
const args = process.argv.slice(2);
const mode = args.find(arg => arg.startsWith('--mode='))?.split('=')[1] || 'basic';
const concurrencyArg = args.find(arg => arg.startsWith('--concurrency='))?.split('=')[1] || '5,1';
const concurrencyLevels = concurrencyArg.split(',').map(c => parseInt(c.trim()));

// Test configuration
const TEST_CONFIGS = {
  basic: {
    fundCount: 120,
    funds: Array.from({length: 120}, (_, i) => `RJFA${(i+1).toString().padStart(3, '0')}`),
    description: 'Mode A: 120 funds (RJFA001-RJFA120)'
  },
  extended: {
    fundCount: 520,
    funds: [
      ...Array.from({length: 120}, (_, i) => `RJFA${(i+1).toString().padStart(3, '0')}`),
      ...Array.from({length: 400}, (_, i) => `RJX${(i+1).toString().padStart(3, '0')}`)
    ],
    description: 'Mode B: 520 funds (RJFA001-RJFA120 + RJX001-RJX400)'
  },
  both: {
    description: 'Both modes A and B'
  }
};

// RPC test definitions
const RPC_TESTS = [
  {
    name: 'get_active_month',
    description: 'Get active month with EOM preference',
    execute: async () => {
      const { data, error } = await supabase.rpc('get_active_month');
      if (error) throw error;
      return data;
    }
  },
  {
    name: 'get_asset_class_table',
    description: 'Get asset class fund table with benchmarks',
    execute: async () => {
      const { data, error } = await supabase.rpc('get_asset_class_table', {
        p_date: '2025-01-31',
        p_include_benchmark: true
      });
      if (error) throw error;
      return data;
    }
  },
  {
    name: 'get_compare_dataset',
    description: 'Get comparison dataset for fund tickers',
    execute: async (fundSample = ['RJFA001', 'RJFA002', 'RJFA003']) => {
      const { data, error } = await supabase.rpc('get_compare_dataset', {
        p_date: '2025-01-31',
        p_tickers: fundSample
      });
      if (error) throw error;
      return data;
    }
  },
  {
    name: 'get_scores_as_of',
    description: 'Get fund scores as of date',
    execute: async () => {
      const { data, error } = await supabase.rpc('get_scores_as_of', {
        p_date: '2025-01-31',
        p_limit: 50
      });
      if (error) throw error;
      return data;
    }
  },
  {
    name: 'get_history_for_tickers',
    description: 'Get historical data for fund tickers',
    execute: async (fundSample = ['RJFA001', 'RJFA002']) => {
      const { data, error } = await supabase.rpc('get_history_for_tickers', {
        p_tickers: fundSample,
        p_to: '2025-01-31'
      });
      if (error) throw error;
      return data;
    }
  },
  {
    name: 'refresh_metric_stats_as_of',
    description: 'Refresh metric statistics for date',
    execute: async () => {
      const { data, error } = await supabase.rpc('refresh_metric_stats_as_of', {
        p_date: '2025-01-31'
      });
      if (error) throw error;
      return data;
    }
  }
];

// Performance measurement utilities
class PerformanceTracker {
  constructor() {
    this.measurements = [];
  }
  
  async measure(fn) {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      this.measurements.push(duration);
      return { result, duration, error: null };
    } catch (error) {
      const duration = performance.now() - start;
      this.measurements.push(duration);
      return { result: null, duration, error };
    }
  }
  
  getStats() {
    if (this.measurements.length === 0) return null;
    
    const sorted = [...this.measurements].sort((a, b) => a - b);
    const len = sorted.length;
    
    return {
      count: len,
      min: sorted[0],
      max: sorted[len - 1],
      mean: sorted.reduce((a, b) => a + b, 0) / len,
      p50: sorted[Math.floor(len * 0.5)],
      p95: sorted[Math.floor(len * 0.95)],
      p99: sorted[Math.floor(len * 0.99)]
    };
  }
  
  reset() {
    this.measurements = [];
  }
}

// Concurrency control
async function runConcurrent(tasks, concurrency) {
  const results = [];
  const executing = [];
  
  for (const task of tasks) {
    const promise = task().then(result => {
      executing.splice(executing.indexOf(promise), 1);
      return result;
    });
    
    results.push(promise);
    executing.push(promise);
    
    if (executing.length >= concurrency) {
      await Promise.race(executing);
    }
  }
  
  return Promise.all(results);
}

// Seed additional funds for Mode B
async function seedAdditionalFunds(funds) {
  console.log(`🌱 Seeding ${funds.length - 120} additional funds for Mode B...`);
  
  // Only seed RJX funds that don't exist
  const { data: existingFunds } = await supabase
    .from('funds')
    .select('ticker')
    .in('ticker', funds.slice(120));
  
  const existingTickers = new Set(existingFunds?.map(f => f.ticker) || []);
  const newFunds = funds.slice(120).filter(ticker => !existingTickers.has(ticker));
  
  if (newFunds.length === 0) {
    console.log('✅ Additional funds already seeded');
    return;
  }
  
  const fundInserts = newFunds.map(ticker => ({
    ticker,
    name: `Extended Test Fund ${ticker}`,
    asset_class: 'Large Cap Blend',
    is_recommended: false,
    notes: 'Seeded for Mode B benchmarking'
  }));
  
  const { error } = await supabase
    .from('funds')
    .insert(fundInserts);
  
  if (error) throw new Error(`Failed to seed additional funds: ${error.message}`);
  
  console.log(`✅ Seeded ${newFunds.length} additional funds`);
}

// Run benchmark for specific configuration
async function runBenchmark(config, concurrency) {
  console.log(`\n🚀 Running benchmark: ${config.description}`);
  console.log(`📊 Concurrency: ${concurrency}`);
  console.log(`⏱️  Testing ${RPC_TESTS.length} RPCs...\n`);
  
  const results = {};
  
  for (const rpcTest of RPC_TESTS) {
    console.log(`  Testing ${rpcTest.name}...`);
    
    const tracker = new PerformanceTracker();
    const iterations = Math.min(concurrency * 3, 15); // Scale iterations with concurrency
    
    // Create test tasks
    const tasks = Array.from({ length: iterations }, () => async () => {
      let testParam = undefined;
      
      // Provide appropriate test parameters
      if (rpcTest.name === 'get_compare_dataset' || rpcTest.name === 'get_history_for_tickers') {
        const sampleSize = Math.min(5, config.funds?.length || 5);
        testParam = config.funds?.slice(0, sampleSize) || ['RJFA001', 'RJFA002', 'RJFA003'];
      }
      
      return tracker.measure(() => rpcTest.execute(testParam));
    });
    
    // Run tasks with specified concurrency
    const taskResults = await runConcurrent(tasks, concurrency);
    
    // Check for errors
    const errors = taskResults.filter(r => r.error);
    if (errors.length > 0) {
      console.log(`    ❌ ${errors.length}/${iterations} calls failed`);
      errors.slice(0, 3).forEach(err => {
        console.log(`       Error: ${err.error.message}`);
      });
    } else {
      console.log(`    ✅ ${iterations} calls succeeded`);
    }
    
    const stats = tracker.getStats();
    results[rpcTest.name] = {
      ...stats,
      errorCount: errors.length,
      successCount: iterations - errors.length,
      description: rpcTest.description
    };
  }
  
  return results;
}

// Generate markdown report
function generateMarkdownReport(benchmarkResults, timestamp) {
  const lines = [];
  
  lines.push('# Sprint 0 Benchmark Results');
  lines.push('');
  lines.push(`**Generated:** ${timestamp}`);
  lines.push(`**Environment:** ${supabaseUrl ? new URL(supabaseUrl).hostname : 'unknown'}`);
  lines.push('');
  
  for (const [configName, concurrencyResults] of Object.entries(benchmarkResults)) {
    lines.push(`## ${configName}`);
    lines.push('');
    
    for (const [concurrency, results] of Object.entries(concurrencyResults)) {
      lines.push(`### Concurrency: ${concurrency}`);
      lines.push('');
      lines.push('| RPC | Description | Calls | Errors | P50 (ms) | P95 (ms) | P99 (ms) | Mean (ms) |');
      lines.push('|-----|-------------|-------|--------|----------|----------|----------|-----------|');
      
      for (const [rpcName, stats] of Object.entries(results)) {
        const p50 = stats.p50?.toFixed(1) || 'N/A';
        const p95 = stats.p95?.toFixed(1) || 'N/A';
        const p99 = stats.p99?.toFixed(1) || 'N/A';
        const mean = stats.mean?.toFixed(1) || 'N/A';
        
        lines.push(`| \`${rpcName}\` | ${stats.description} | ${stats.count || 0} | ${stats.errorCount || 0} | ${p50} | ${p95} | ${p99} | ${mean} |`);
      }
      
      lines.push('');
    }
  }
  
  // Performance thresholds analysis
  lines.push('## Performance Analysis');
  lines.push('');
  lines.push('### Threshold Violations');
  lines.push('');
  lines.push('| RPC | Concurrency | P95 Threshold | Actual P95 | Status |');
  lines.push('|-----|-------------|---------------|------------|--------|');
  
  const P95_THRESHOLDS = {
    get_active_month: 100,
    get_asset_class_table: 500,
    get_compare_dataset: 300,
    get_scores_as_of: 400,
    get_history_for_tickers: 600,
    refresh_metric_stats_as_of: 1000
  };
  
  for (const [configName, concurrencyResults] of Object.entries(benchmarkResults)) {
    for (const [concurrency, results] of Object.entries(concurrencyResults)) {
      for (const [rpcName, stats] of Object.entries(results)) {
        const threshold = P95_THRESHOLDS[rpcName] || 500;
        const actual = stats.p95 || 0;
        const status = actual <= threshold ? '✅ PASS' : '❌ FAIL';
        
        lines.push(`| \`${rpcName}\` | ${concurrency} | ${threshold}ms | ${actual.toFixed(1)}ms | ${status} |`);
      }
    }
  }
  
  lines.push('');
  lines.push('### Notes');
  lines.push('- P95 thresholds are baseline expectations for Sprint 0');
  lines.push('- Performance will be optimized in subsequent sprints');
  lines.push('- Errors indicate RPC implementation issues requiring attention');
  
  return lines.join('\n');
}

// Main benchmark function
async function runBenchmarks() {
  console.log('🎯 Sprint 0 RPC Benchmark Harness');
  console.log('==================================\n');
  
  const timestamp = new Date().toISOString();
  const benchmarkResults = {};
  
  // Determine which modes to run
  const modesToRun = mode === 'both' ? ['basic', 'extended'] : [mode];
  
  try {
    for (const modeName of modesToRun) {
      const config = TEST_CONFIGS[modeName];
      
      if (modeName === 'extended') {
        await seedAdditionalFunds(config.funds);
      }
      
      benchmarkResults[config.description] = {};
      
      for (const concurrency of concurrencyLevels) {
        const results = await runBenchmark(config, concurrency);
        benchmarkResults[config.description][concurrency] = results;
      }
    }
    
    // Generate and save report
    const reportContent = generateMarkdownReport(benchmarkResults, timestamp);
    const reportPath = path.join(__dirname, 'results', `benchmark_${Date.now()}.md`);
    
    fs.writeFileSync(reportPath, reportContent);
    
    console.log('\n✅ Benchmark completed successfully!');
    console.log(`📊 Report saved: ${reportPath}`);
    console.log('\n📋 Quick Summary:');
    
    for (const [configName, concurrencyResults] of Object.entries(benchmarkResults)) {
      console.log(`\n${configName}:`);
      for (const [concurrency, results] of Object.entries(concurrencyResults)) {
        const avgP95 = Object.values(results).reduce((sum, stat) => sum + (stat.p95 || 0), 0) / Object.keys(results).length;
        const totalErrors = Object.values(results).reduce((sum, stat) => sum + (stat.errorCount || 0), 0);
        console.log(`  Concurrency ${concurrency}: Avg P95 ${avgP95.toFixed(1)}ms, ${totalErrors} errors`);
      }
    }
    
  } catch (error) {
    console.error('❌ Benchmark failed:', error.message);
    process.exit(1);
  }
}

// Run benchmarks
if (require.main === module) {
  runBenchmarks();
}

module.exports = { runBenchmarks };