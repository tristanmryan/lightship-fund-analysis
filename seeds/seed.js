// seeds/seed.js
// Deterministic seed script for Sprint 0 baseline environment

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

// Asset class data (32 classes from assetClassGroups.js)
const assetClassData = [
  // U.S. Equity (9 classes)
  'Large Cap Growth', 'Large Cap Blend', 'Large Cap Value',
  'Mid-Cap Growth', 'Mid-Cap Blend', 'Mid-Cap Value',
  'Small Cap Growth', 'Small Cap Core', 'Small Cap Value',
  
  // International Equity (3 classes)
  'International Stock (Large Cap)', 'International Stock (Small/Mid Cap)', 'Emerging Markets',
  
  // Fixed Income (12 classes)
  'Money Market', 'Short Term Muni', 'Intermediate Muni', 'High Yield Muni', 'Mass Muni Bonds',
  'Short Term Bonds', 'Intermediate Term Bonds', 'High Yield Bonds', 'Foreign Bonds',
  'Multi Sector Bonds', 'Non-Traditional Bonds', 'Convertible Bonds',
  
  // Alternative Investments (7 classes)
  'Multi-Asset Income', 'Preferred Stock', 'Long/Short', 'Real Estate',
  'Hedged/Enhanced', 'Tactical', 'Asset Allocation',
  
  // Sector Funds (1 class)
  'Sector Funds'
];

// Benchmark data (28 benchmarks - approximately 1 per asset class, some have multiples)
const benchmarkData = [
  // U.S. Equity benchmarks
  { ticker: 'IWF', name: 'Russell 1000 Growth ETF', asset_class: 'Large Cap Growth' },
  { ticker: 'ITOT', name: 'Core S&P Total US Stock Market ETF', asset_class: 'Large Cap Blend' },
  { ticker: 'IWD', name: 'Russell 1000 Value ETF', asset_class: 'Large Cap Value' },
  { ticker: 'IWP', name: 'Russell Mid-Cap Growth ETF', asset_class: 'Mid-Cap Growth' },
  { ticker: 'IJH', name: 'Core S&P Mid-Cap ETF', asset_class: 'Mid-Cap Blend' },
  { ticker: 'IWS', name: 'Russell Mid-Cap Value ETF', asset_class: 'Mid-Cap Value' },
  { ticker: 'IWO', name: 'Russell 2000 Growth ETF', asset_class: 'Small Cap Growth' },
  { ticker: 'IJR', name: 'Core S&P Small-Cap ETF', asset_class: 'Small Cap Core' },
  { ticker: 'IWN', name: 'Russell 2000 Value ETF', asset_class: 'Small Cap Value' },
  
  // International benchmarks - Use actual CSV tickers
  { ticker: 'EFA', name: 'MSCI EAFE ETF', asset_class: 'International Stock (Large Cap)' },
  { ticker: 'SCZ', name: 'MSCI EAFE Small-Cap ETF', asset_class: 'International Stock (Small/Mid Cap)' },
  { ticker: 'ACWX', name: 'MSCI ACWI ex US ETF', asset_class: 'Emerging Markets' },
  
  // Fixed Income benchmarks - Use actual CSV tickers
  { ticker: 'BIL', name: 'SPDR Bloomberg 1-3 Month T-Bill ETF', asset_class: 'Money Market' },
  { ticker: 'SHM', name: 'Short-Term Muni ETF', asset_class: 'Short Term Muni' },
  { ticker: 'MUB', name: 'Intermediate Muni ETF', asset_class: 'Intermediate Muni' },
  { ticker: 'HYD', name: 'High Yield Muni ETF', asset_class: 'High Yield Muni' },
  { ticker: 'MTUM', name: 'Mass Muni Bond ETF', asset_class: 'Mass Muni Bonds' },
  { ticker: 'GOVT', name: 'Short Term Treasury ETF', asset_class: 'Short Term Bonds' },
  { ticker: 'IEF', name: 'Intermediate Treasury ETF', asset_class: 'Intermediate Term Bonds' },
  { ticker: 'HYG', name: 'High Yield Corporate Bond ETF', asset_class: 'High Yield Bonds' },
  { ticker: 'BNDX', name: 'International Bond ETF', asset_class: 'Foreign Bonds' },
  { ticker: 'AGG', name: 'Core Aggregate Bond ETF', asset_class: 'Multi Sector Bonds' },
  { ticker: 'FLOT', name: 'Floating Rate Bond ETF', asset_class: 'Non-Traditional Bonds' },
  { ticker: 'CWB', name: 'Convertible Securities ETF', asset_class: 'Convertible Bonds' },
  
  // Alternative benchmarks
  { ticker: 'JEPI', name: 'JPMorgan Equity Premium Income ETF', asset_class: 'Multi-Asset Income' },
  { ticker: 'PFF', name: 'Preferred Stock ETF', asset_class: 'Preferred Stock' },
  { ticker: 'MNA', name: 'Long/Short ETF', asset_class: 'Long/Short' },
  { ticker: 'VNQ', name: 'Real Estate Investment Trust ETF', asset_class: 'Real Estate' }
];

// Generate 12 EOM dates from 2024-08-31 to 2025-07-31
function generateEOMDates() {
  const dates = [];
  
  // Generate specific EOM dates to avoid calculation issues
  const eomDates = [
    '2024-08-31', '2024-09-30', '2024-10-31', '2024-11-30', '2024-12-31',
    '2025-01-31', '2025-02-28', '2025-03-31', '2025-04-30', '2025-05-31',
    '2025-06-30', '2025-07-31'
  ];
  
  return eomDates;
}

// Deterministic random number generator for consistent test data
class SeededRandom {
  constructor(seed = 12345) {
    this.seed = seed;
  }
  
  next() {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }
  
  range(min, max) {
    return min + this.next() * (max - min);
  }
  
  choice(array) {
    return array[Math.floor(this.next() * array.length)];
  }
}

// Progress logging helper
function logProgress(current, total, label) {
  const percent = Math.round((current / total) * 100);
  if (percent % 10 === 0 && percent > 0) {
    console.log(`[${percent}%] ${label}...`);
  }
}

// Helper functions for asset class mapping (matching assetClassGroups.js structure)
function getAssetClassGroup(assetClassName) {
  if (['Large Cap Growth', 'Large Cap Blend', 'Large Cap Value', 'Mid-Cap Growth', 'Mid-Cap Blend', 'Mid-Cap Value', 'Small Cap Growth', 'Small Cap Core', 'Small Cap Value'].includes(assetClassName)) {
    return 'U.S. Equity';
  }
  if (['International Stock (Large Cap)', 'International Stock (Small/Mid Cap)', 'Emerging Markets'].includes(assetClassName)) {
    return 'International Equity';
  }
  if (['Money Market', 'Short Term Muni', 'Intermediate Muni', 'High Yield Muni', 'Mass Muni Bonds', 'Short Term Bonds', 'Intermediate Term Bonds', 'High Yield Bonds', 'Foreign Bonds', 'Multi Sector Bonds', 'Non-Traditional Bonds', 'Convertible Bonds'].includes(assetClassName)) {
    return 'Fixed Income';
  }
  if (['Multi-Asset Income', 'Preferred Stock', 'Long/Short', 'Real Estate', 'Hedged/Enhanced', 'Tactical', 'Asset Allocation'].includes(assetClassName)) {
    return 'Alternative Investments';
  }
  if (assetClassName === 'Sector Funds') {
    return 'Sector Funds';
  }
  return 'Other';
}

function getAssetClassSortGroup(assetClassName) {
  const group = getAssetClassGroup(assetClassName);
  switch (group) {
    case 'U.S. Equity': return 1;
    case 'International Equity': return 2;
    case 'Fixed Income': return 3;
    case 'Alternative Investments': return 4;
    case 'Sector Funds': return 5;
    default: return 6;
  }
}

// Main seeding function
async function seedDatabase() {
  console.log('Starting deterministic database seeding...');
  
  const rng = new SeededRandom(42); // Fixed seed for deterministic results
  const eomDates = generateEOMDates();
  
  try {
    // 1. Seed Asset Classes
    console.log('\n🎯 Seeding Asset Classes...');
    // Delete existing test asset classes (keep any existing ones that might be important)
    await supabase.from('asset_classes').delete().in('name', assetClassData);
    
    const assetClassInserts = assetClassData.map((name, index) => ({
      code: name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
      name,
      description: `${name} asset class for investment analysis`,
      group_name: getAssetClassGroup(name),
      sort_group: getAssetClassSortGroup(name),
      sort_order: index
    }));
    
    const { data: assetClasses, error: acError } = await supabase
      .from('asset_classes')
      .insert(assetClassInserts)
      .select();
    
    if (acError) throw new Error(`Asset classes error: ${acError.message}`);
    
    const assetClassMap = {};
    assetClasses.forEach(ac => assetClassMap[ac.name] = ac.id);
    
    // 2. Seed Benchmarks
    console.log('\n📊 Seeding Benchmarks...');
    // Delete our test benchmarks and their links
    const testTickers = benchmarkData.map(b => b.ticker);
    
    // First get existing benchmark IDs to delete links
    const { data: existingBenchmarks } = await supabase
      .from('benchmarks')
      .select('id')
      .in('ticker', testTickers);
    
    if (existingBenchmarks && existingBenchmarks.length > 0) {
      const benchmarkIds = existingBenchmarks.map(b => b.id);
      await supabase.from('asset_class_benchmarks').delete().in('benchmark_id', benchmarkIds);
    }
    
    // Then delete the benchmarks
    await supabase.from('benchmarks').delete().in('ticker', testTickers);
    
    const benchmarkInserts = benchmarkData.map(b => ({
      ticker: b.ticker,
      name: b.name,
      asset_class: b.asset_class
    }));
    
    const { data: benchmarks, error: benchError } = await supabase
      .from('benchmarks')
      .insert(benchmarkInserts)
      .select();
    
    if (benchError) throw new Error(`Benchmarks error: ${benchError.message}`);
    
    // Link benchmarks to asset classes as primary
    const acbInserts = benchmarks.map(b => ({
      asset_class_id: assetClassMap[b.asset_class],
      benchmark_id: b.id,
      kind: 'primary'
    }));
    
    const { error: acbError } = await supabase
      .from('asset_class_benchmarks')
      .insert(acbInserts);
    
    if (acbError) throw new Error(`Asset class benchmarks error: ${acbError.message}`);
    
    // 3. Seed Funds (RJFA001-RJFA120)
    console.log('\n💰 Seeding Funds...');
    // Delete existing test funds (both RJFA and RJX from benchmark runs)
    await supabase.from('funds').delete().like('ticker', 'RJFA%');
    await supabase.from('funds').delete().like('ticker', 'RJX%');
    
    const fundInserts = [];
    for (let i = 1; i <= 120; i++) {
      const ticker = `RJFA${i.toString().padStart(3, '0')}`;
      const assetClass = rng.choice(assetClassData);
      const assetClassId = assetClassMap[assetClass];
      
      if (!assetClassId) {
        console.warn(`Warning: No asset class ID found for ${assetClass}, using first available`);
      }
      
      fundInserts.push({
        ticker,
        name: `Raymond James Fund ${ticker}`,
        asset_class: assetClass,
        asset_class_id: assetClassId || Object.values(assetClassMap)[0], // Fallback to first AC
        is_recommended: i <= 20, // First 20 are recommended
        notes: `Seeded test fund for asset class: ${assetClass}`
      });
      
      logProgress(i, 120, 'Creating funds');
    }
    
    // Insert funds in batches with error handling
    const fundBatchSize = 20;
    let successfulFunds = 0;
    
    for (let i = 0; i < fundInserts.length; i += fundBatchSize) {
      const batch = fundInserts.slice(i, i + fundBatchSize);
      const { data, error: fundError } = await supabase
        .from('funds')
        .insert(batch)
        .select();
      
      if (fundError) {
        console.warn(`Fund batch error: ${fundError.message}`);
        // Try inserting individually to identify problematic records
        for (const fund of batch) {
          const { error: singleError } = await supabase
            .from('funds')
            .insert([fund]);
          if (!singleError) successfulFunds++;
        }
      } else {
        successfulFunds += data?.length || 0;
      }
    }
    
    console.log(`Successfully inserted ${successfulFunds} funds`);
    
    // Get actual list of inserted fund tickers for performance data
    const { data: insertedFunds } = await supabase
      .from('funds')
      .select('ticker')
      .like('ticker', 'RJFA%')
      .order('ticker');
    
    const actualFundTickers = insertedFunds?.map(f => f.ticker) || [];
    
    console.log(`\n🔍 Fund Analysis:`);
    console.log(`   • Expected funds: 120 (RJFA001-RJFA120)`);
    console.log(`   • Actually inserted: ${actualFundTickers.length}`);
    
    if (actualFundTickers.length < 120) {
      // Find missing funds
      const expectedTickers = Array.from({length: 120}, (_, i) => `RJFA${(i+1).toString().padStart(3, '0')}`);
      const missingTickers = expectedTickers.filter(ticker => !actualFundTickers.includes(ticker));
      console.log(`   • Missing funds: ${missingTickers.length} -> ${missingTickers.slice(0, 5).join(', ')}${missingTickers.length > 5 ? '...' : ''}`);
    }
    
    // 4. Seed Performance Data
    console.log('\n📈 Seeding Performance Data...');
    // Delete ALL existing performance data for test funds (comprehensive cleanup)
    console.log('   Performing comprehensive cleanup of existing performance data...');
    
    // Use more specific deletion to ensure we get everything
    for (let i = 1; i <= 120; i++) {
      const ticker = `RJFA${i.toString().padStart(3, '0')}`;
      await supabase.from('fund_performance').delete().eq('fund_ticker', ticker);
    }
    
    // Also clean RJX range from benchmark testing
    for (let i = 1; i <= 400; i++) {
      const ticker = `RJX${i.toString().padStart(3, '0')}`;
      await supabase.from('fund_performance').delete().eq('fund_ticker', ticker);
    }
    
    console.log('   Cleanup completed - database should be clean for fresh inserts');
    
    const performanceInserts = [];
    let insertCount = 0;
    const totalInserts = actualFundTickers.length * 12; // actual funds × 12 months
    
    // Create performance data for exactly the expected RJFA funds (deterministic approach)
    const expectedFundTickers = Array.from({length: 120}, (_, i) => `RJFA${(i+1).toString().padStart(3, '0')}`);
    
    // Reset the RNG to ensure consistent random data generation for performance
    const performanceRng = new SeededRandom(42);
    
    for (const ticker of expectedFundTickers) {
      // Verify this fund exists before creating performance data
      const fundExists = actualFundTickers.includes(ticker);
      if (!fundExists) {
        console.warn(`⚠️  Fund ${ticker} not found in database, skipping performance data`);
        continue;
      }
      
      for (const date of eomDates) {
        // Generate realistic but deterministic performance metrics using separate RNG
        const baseReturn = performanceRng.range(-20, 25); // Base annual return
        
        performanceInserts.push({
          fund_ticker: ticker,
          date,
          ytd_return: Number((baseReturn * performanceRng.range(0.3, 1.2)).toFixed(4)),
          one_year_return: Number((baseReturn * performanceRng.range(0.8, 1.3)).toFixed(4)),
          three_year_return: Number((baseReturn * performanceRng.range(0.6, 1.1)).toFixed(4)),
          five_year_return: Number((baseReturn * performanceRng.range(0.7, 1.0)).toFixed(4)),
          ten_year_return: Number((baseReturn * performanceRng.range(0.5, 0.9)).toFixed(4)),
          sharpe_ratio: Number(performanceRng.range(0.2, 2.5).toFixed(4)),
          standard_deviation: Number(performanceRng.range(5, 25).toFixed(4)),
          standard_deviation_3y: Number(performanceRng.range(6, 28).toFixed(4)),
          standard_deviation_5y: Number(performanceRng.range(7, 30).toFixed(4)),
          expense_ratio: Number(performanceRng.range(0.1, 2.5).toFixed(4)),
          alpha: Number(performanceRng.range(-3, 5).toFixed(4)),
          beta: Number(performanceRng.range(0.3, 1.8).toFixed(4)),
          manager_tenure: Number(performanceRng.range(0.5, 15).toFixed(2))
        });
        
        insertCount++;
        logProgress(insertCount, totalInserts, 'Creating performance records');
      }
    }
    
    // Insert performance data in batches - now should be clean after deletion
    // Try smaller batches to avoid database limits
    const batchSize = 50;
    let successfulInserts = 0;
    let failedInserts = 0;
    
    console.log(`\n📊 Inserting ${performanceInserts.length} performance records in batches of ${batchSize}...`);
    
    for (let i = 0; i < performanceInserts.length; i += batchSize) {
      const batch = performanceInserts.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(performanceInserts.length / batchSize);
      
      console.log(`   Batch ${batchNum}/${totalBatches}: Records ${i+1}-${Math.min(i+batchSize, performanceInserts.length)}`);
      console.log(`     Fund range: ${batch[0].fund_ticker} to ${batch[batch.length-1].fund_ticker}`);
      
      const { data, error: perfError } = await supabase
        .from('fund_performance')
        .upsert(batch, { 
          onConflict: 'fund_ticker,date',
          ignoreDuplicates: false 
        })
        .select();  // Use upsert to handle any remaining duplicates
      
      if (perfError) {
        console.warn(`   ❌ Batch ${batchNum} FAILED: ${perfError.message}`);
        console.warn(`   Sample failed record: ${JSON.stringify(batch[0])}`);
        
        // Try individual inserts to identify problematic records
        let batchSuccessful = 0;
        for (const record of batch) {
          const { data: singleData, error: singleError } = await supabase
            .from('fund_performance')
            .insert([record])
            .select();
          
          if (singleError) {
            failedInserts++;
            if (failedInserts <= 5) { // Log first few failures for debugging
              console.warn(`     Individual failed: ${record.fund_ticker} on ${record.date} - ${singleError.message}`);
            }
          } else {
            batchSuccessful += singleData?.length || 0;
          }
        }
        successfulInserts += batchSuccessful;
        console.log(`   Individual results: ${batchSuccessful} successful, ${batch.length - batchSuccessful} failed`);
      } else {
        const insertedCount = data?.length || 0;
        successfulInserts += insertedCount;
        console.log(`   ✅ Batch ${batchNum} SUCCESS: ${insertedCount} records inserted`);
        
        if (insertedCount !== batch.length) {
          console.warn(`   ⚠️  Expected ${batch.length} but inserted ${insertedCount} records`);
        }
        
        // Add small delay to avoid overwhelming the database
        if (batchNum % 5 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }
    
    console.log(`\n📊 Performance Insertion Results:`);
    console.log(`   • Successful: ${successfulInserts} records`);
    console.log(`   • Failed: ${failedInserts} records`);
    console.log(`   • Total attempted: ${performanceInserts.length} records`);
    console.log(`   • Success rate: ${((successfulInserts/performanceInserts.length)*100).toFixed(1)}%`);
    
    // 4b. Seed Benchmark Performance Data
    console.log('\n📊 Seeding Benchmark Performance Data...');
    
    // Delete existing benchmark performance data for test benchmarks
    const benchmarkTickers = benchmarkData.map(b => b.ticker);
    await supabase.from('benchmark_performance').delete().in('benchmark_ticker', benchmarkTickers);
    
    // Create benchmark performance data for the same EOM dates
    const benchmarkPerformanceInserts = [];
    const benchmarkPerfRng = new SeededRandom(123); // Different seed for benchmarks
    
    for (const benchmark of benchmarkData) {
      for (const date of eomDates) {
        // Generate realistic benchmark performance data
        const baseReturn = benchmarkPerfRng.range(-15, 20); // Slightly more conservative than funds
        
        benchmarkPerformanceInserts.push({
          benchmark_ticker: benchmark.ticker,
          date,
          ytd_return: Number((baseReturn * benchmarkPerfRng.range(0.4, 1.1)).toFixed(4)),
          one_year_return: Number((baseReturn * benchmarkPerfRng.range(0.7, 1.2)).toFixed(4)),
          three_year_return: Number((baseReturn * benchmarkPerfRng.range(0.5, 1.0)).toFixed(4)),
          five_year_return: Number((baseReturn * benchmarkPerfRng.range(0.6, 0.9)).toFixed(4)),
          ten_year_return: Number((baseReturn * benchmarkPerfRng.range(0.4, 0.8)).toFixed(4)),
          sharpe_ratio: Number(benchmarkPerfRng.range(0.1, 2.0).toFixed(4)),
          standard_deviation: Number(benchmarkPerfRng.range(4, 22).toFixed(4)),
          standard_deviation_3y: Number(benchmarkPerfRng.range(5, 25).toFixed(4)),
          standard_deviation_5y: Number(benchmarkPerfRng.range(6, 28).toFixed(4)),
          expense_ratio: Number(benchmarkPerfRng.range(0.05, 0.5).toFixed(4)),
          alpha: Number(benchmarkPerfRng.range(-2, 3).toFixed(4)),
          beta: Number(benchmarkPerfRng.range(0.2, 1.5).toFixed(4)),
          up_capture_ratio: Number(benchmarkPerfRng.range(80, 120).toFixed(4)),
          down_capture_ratio: Number(benchmarkPerfRng.range(80, 120).toFixed(4))
        });
      }
    }
    
    // Insert benchmark performance data in batches
    const benchmarkBatchSize = 50;
    let successfulBenchmarkInserts = 0;
    
    console.log(`   Inserting ${benchmarkPerformanceInserts.length} benchmark performance records...`);
    
    for (let i = 0; i < benchmarkPerformanceInserts.length; i += benchmarkBatchSize) {
      const batch = benchmarkPerformanceInserts.slice(i, i + benchmarkBatchSize);
      const { error: benchPerfError } = await supabase
        .from('benchmark_performance')
        .insert(batch);
      
      if (benchPerfError) {
        console.warn(`     Benchmark performance batch error: ${benchPerfError.message}`);
        // Try inserting individually
        for (const record of batch) {
          const { error: singleError } = await supabase
            .from('benchmark_performance')
            .insert([record]);
          if (!singleError) successfulBenchmarkInserts++;
        }
      } else {
        successfulBenchmarkInserts += batch.length;
      }
    }
    
    console.log(`   ✅ Benchmark performance data: ${successfulBenchmarkInserts}/${benchmarkPerformanceInserts.length} records inserted`);
    
    // Wait a moment for database to process all inserts
    console.log(`\n⏳ Waiting for database to complete processing...`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Try to insert missing records individually to debug the issue
    console.log(`\n🔍 Checking for missing records and attempting individual inserts...`);
    
    // Check which funds are missing performance data using the same logic as verification
    const { data: allExistingPerf } = await supabase
      .from('fund_performance')
      .select('fund_ticker')
      .like('fund_ticker', 'RJFA%');
    
    const existingFundsInPerf = new Set(allExistingPerf?.map(p => p.fund_ticker) || []);
    const missingFunds = [];
    
    for (let i = 1; i <= 120; i++) {
      const ticker = `RJFA${i.toString().padStart(3, '0')}`;
      if (!existingFundsInPerf.has(ticker)) {
        missingFunds.push(ticker);
      }
    }
    
    if (missingFunds.length > 0) {
      console.log(`   Found ${missingFunds.length} funds without performance data: ${missingFunds.slice(0, 5).join(', ')}${missingFunds.length > 5 ? '...' : ''}`);
      
      // Insert all missing performance data using the original RNG to maintain determinism
      const correctiveRng = new SeededRandom(42);
      let correctiveInserts = 0;
      
      for (const ticker of missingFunds) {
        console.log(`   Inserting missing performance data for ${ticker}...`);
        
        const correctiveRecords = eomDates.map(date => {
          const baseReturn = correctiveRng.range(-20, 25);
          return {
            fund_ticker: ticker,
            date,
            ytd_return: Number((baseReturn * correctiveRng.range(0.3, 1.2)).toFixed(4)),
            one_year_return: Number((baseReturn * correctiveRng.range(0.8, 1.3)).toFixed(4)),
            three_year_return: Number((baseReturn * correctiveRng.range(0.6, 1.1)).toFixed(4)),
            five_year_return: Number((baseReturn * correctiveRng.range(0.7, 1.0)).toFixed(4)),
            ten_year_return: Number((baseReturn * correctiveRng.range(0.5, 0.9)).toFixed(4)),
            sharpe_ratio: Number(correctiveRng.range(0.2, 2.5).toFixed(4)),
            standard_deviation: Number(correctiveRng.range(5, 25).toFixed(4)),
            standard_deviation_3y: Number(correctiveRng.range(6, 28).toFixed(4)),
            standard_deviation_5y: Number(correctiveRng.range(7, 30).toFixed(4)),
            expense_ratio: Number(correctiveRng.range(0.1, 2.5).toFixed(4)),
            alpha: Number(correctiveRng.range(-3, 5).toFixed(4)),
            beta: Number(correctiveRng.range(0.3, 1.8).toFixed(4)),
            manager_tenure: Number(correctiveRng.range(0.5, 15).toFixed(2))
          };
        });
        
        // Insert one by one for better error tracking
        for (const record of correctiveRecords) {
          const { data, error } = await supabase
            .from('fund_performance')
            .insert([record])
            .select();
          
          if (error) {
            console.log(`     ❌ Failed: ${record.fund_ticker} on ${record.date} - ${error.message}`);
          } else {
            correctiveInserts++;
          }
        }
      }
      
      console.log(`   ✅ Corrective inserts completed: ${correctiveInserts} records added`);
    } else {
      console.log(`   ✅ All 120 funds have performance data`);
    }

    // Verify benchmark performance data first to get the count
    const { data: finalBenchPerf, count: benchPerfCount } = await supabase
      .from('benchmark_performance')
      .select('benchmark_ticker, date', { count: 'exact' })
      .in('benchmark_ticker', benchmarkTickers);
    
    const uniqueBenchmarksInPerf = [...new Set(finalBenchPerf?.map(p => p.benchmark_ticker) || [])];
    
    // Check for missing benchmark performance data and insert if needed
    if (uniqueBenchmarksInPerf.length < benchmarkData.length) {
      console.log(`   Found ${benchmarkData.length - uniqueBenchmarksInPerf.length} benchmarks without performance data`);
      
      const missingBenchTickers = benchmarkTickers.filter(ticker => !uniqueBenchmarksInPerf.includes(ticker));
      console.log(`   Inserting missing benchmark performance data for: ${missingBenchTickers.slice(0, 5).join(', ')}${missingBenchTickers.length > 5 ? '...' : ''}`);
      
      // Insert missing benchmark performance data
      let correctiveBenchInserts = 0;
      
      for (const ticker of missingBenchTickers) {
        console.log(`   Inserting missing benchmark performance data for ${ticker}...`);
        
        const correctiveBenchRecords = eomDates.map(date => {
          const baseReturn = benchmarkPerfRng.range(-15, 20);
          return {
            benchmark_ticker: ticker,
            date,
            ytd_return: Number((baseReturn * benchmarkPerfRng.range(0.4, 1.1)).toFixed(4)),
            one_year_return: Number((baseReturn * benchmarkPerfRng.range(0.7, 1.2)).toFixed(4)),
            three_year_return: Number((baseReturn * benchmarkPerfRng.range(0.5, 1.0)).toFixed(4)),
            five_year_return: Number((baseReturn * benchmarkPerfRng.range(0.6, 0.9)).toFixed(4)),
            ten_year_return: Number((baseReturn * benchmarkPerfRng.range(0.4, 0.8)).toFixed(4)),
            sharpe_ratio: Number(benchmarkPerfRng.range(0.1, 2.0).toFixed(4)),
            standard_deviation: Number(benchmarkPerfRng.range(4, 22).toFixed(4)),
            standard_deviation_3y: Number(benchmarkPerfRng.range(5, 25).toFixed(4)),
            standard_deviation_5y: Number(benchmarkPerfRng.range(6, 28).toFixed(4)),
            expense_ratio: Number(benchmarkPerfRng.range(0.05, 0.5).toFixed(4)),
            alpha: Number(benchmarkPerfRng.range(-2, 3).toFixed(4)),
            beta: Number(benchmarkPerfRng.range(0.2, 1.5).toFixed(4)),
            up_capture_ratio: Number(benchmarkPerfRng.range(80, 120).toFixed(4)),
            down_capture_ratio: Number(benchmarkPerfRng.range(80, 120).toFixed(4))
          };
        });
        
        // Insert one by one for better error tracking
        for (const record of correctiveBenchRecords) {
          const { data, error } = await supabase
            .from('benchmark_performance')
            .insert([record])
            .select();
          
          if (error) {
            console.log(`     ❌ Failed: ${record.benchmark_ticker} on ${record.date} - ${error.message}`);
          } else {
            correctiveBenchInserts++;
          }
        }
      }
      
      console.log(`   ✅ Corrective benchmark inserts completed: ${correctiveBenchInserts} records added`);
    } else {
      console.log(`   ✅ All ${benchmarkData.length} benchmarks have performance data`);
    }

    // Verify actual insertion counts - refresh to avoid cache
    const { data: finalFunds } = await supabase.from('funds').select('ticker').like('ticker', 'RJFA%');
    
    // Get more detailed performance data count
    const { data: finalPerf, count: perfCount } = await supabase
      .from('fund_performance')
      .select('fund_ticker, date', { count: 'exact' })
      .like('fund_ticker', 'RJFA%');
    
    // Also verify unique fund count in performance data
    const uniqueFundsInPerf = [...new Set(finalPerf?.map(p => p.fund_ticker) || [])];
    
    console.log(`\n🔍 Final Verification:`);
    console.log(`   • Funds in database: ${finalFunds?.length || 0}`);
    console.log(`   • Performance records in database: ${finalPerf?.length || 0} (count: ${perfCount})`);
    console.log(`   • Unique funds with performance data: ${uniqueFundsInPerf.length}`);
    console.log(`   • Benchmarks in database: ${benchmarkData.length}`);
    console.log(`   • Benchmark performance records: ${finalBenchPerf?.length || 0} (count: ${benchPerfCount})`);
    console.log(`   • Unique benchmarks with performance data: ${uniqueBenchmarksInPerf.length}`);
    
    if (uniqueBenchmarksInPerf.length < benchmarkData.length) {
      const missingBenchTickers = benchmarkTickers.filter(ticker => !uniqueBenchmarksInPerf.includes(ticker));
      console.log(`   • Benchmarks missing performance data (${missingBenchTickers.length}): ${missingBenchTickers.slice(0, 5).join(', ')}${missingBenchTickers.length > 5 ? '...' : ''}`);
    } else {
      console.log(`   • ✅ All ${benchmarkData.length} benchmarks have performance data`);
    }
    
    if (uniqueFundsInPerf.length < 120) {
      const expectedTickers = Array.from({length: 120}, (_, i) => `RJFA${(i+1).toString().padStart(3, '0')}`);
      const missingPerfTickers = expectedTickers.filter(ticker => !uniqueFundsInPerf.includes(ticker));
      console.log(`   • Funds missing performance data (${missingPerfTickers.length}): ${missingPerfTickers.slice(0, 5).join(', ')}${missingPerfTickers.length > 5 ? '...' : ''}`);
      
      // Debug: Check if these missing funds exist in the funds table
      const { data: missingFundsCheck } = await supabase
        .from('funds')
        .select('ticker')
        .in('ticker', missingPerfTickers.slice(0, 10));
      
      console.log(`   • Missing funds that exist in funds table: ${missingFundsCheck?.map(f => f.ticker).join(', ') || 'none'}`);
    }
    
    console.log(`\n🔍 Debug info:`);
    console.log(`   • actualFundTickers.length: ${actualFundTickers.length}`);
    console.log(`   • eomDates.length: ${eomDates.length}`);
    console.log(`   • Expected records: ${actualFundTickers.length * eomDates.length}`);
    
    // Summary
    console.log('\n✅ Database seeding completed successfully!');
    console.log(`📊 Summary:`);
    console.log(`   • ${assetClassData.length} asset classes`);
    console.log(`   • ${benchmarkData.length} benchmarks`);
    console.log(`   • ${finalFunds?.length || 0} funds actually inserted (RJFA001-RJFA120)`);
    console.log(`   • ${performanceInserts.length} performance records prepared`);
    console.log(`   • ${finalPerf?.length || 0} performance records actually inserted (count: ${perfCount})`);
    console.log(`   • ${benchmarkPerformanceInserts.length} benchmark performance records prepared`);
    console.log(`   • ${finalBenchPerf?.length || 0} benchmark performance records actually inserted (count: ${benchPerfCount})`);
    console.log(`   • ${eomDates.length} months of data (${eomDates[0]} to ${eomDates[eomDates.length-1]})`);
    console.log(`   • First 20 funds marked as recommended`);
    console.log(`   • Test benchmarks: ${benchmarkTickers.slice(0, 5).join(', ')}${benchmarkTickers.length > 5 ? '...' : ''}`);
    
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  }
}

// Run the seeder
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };