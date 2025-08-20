#!/usr/bin/env node

/**
 * Test script for server-side scoring integration
 * Verifies that the feature flag correctly switches between server and client-side scoring
 * 
 * Usage: node scripts/testServerScoringIntegration.js
 */

import { createClient } from '@supabase/supabase-js';
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

console.log('🧪 Testing Server-Side Scoring Integration');
console.log('='.repeat(50));

/**
 * Test server-side scoring RPC directly
 */
async function testServerScoringRPC() {
  console.log('\n📊 Testing server-side scoring RPC...');
  
  try {
    // Test with a specific date
    const testDate = '2025-07-31';
    
    const { data, error } = await supabase.rpc('calculate_scores_as_of', {
      p_date: testDate,
      p_asset_class_id: null
    });

    if (error) {
      console.log(`   ❌ RPC call failed: ${error.message}`);
      return false;
    }

    if (!data || data.length === 0) {
      console.log('   ⚠️  RPC returned no data');
      return false;
    }

    console.log(`   ✅ RPC call successful: ${data.length} funds scored`);
    
    // Check sample data structure
    const sample = data[0];
    if (sample) {
      console.log(`   📋 Sample fund: ${sample.ticker} - Score: ${sample.score_final}, Percentile: ${sample.percentile}`);
    }

    return true;
  } catch (error) {
    console.log(`   ❌ RPC test failed: ${error.message}`);
    return false;
  }
}

/**
 * Test asset class table RPC with server-side scoring
 */
async function testAssetClassTableRPC() {
  console.log('\n🏢 Testing asset class table RPC...');
  
  try {
    const testDate = '2025-07-31';
    
    const { data, error } = await supabase.rpc('get_asset_class_table', {
      p_date: testDate,
      p_asset_class_id: null,
      p_include_benchmark: true
    });

    if (error) {
      console.log(`   ❌ Asset class table RPC failed: ${error.message}`);
      return false;
    }

    if (!data || data.length === 0) {
      console.log('   ⚠️  Asset class table returned no data');
      return false;
    }

    console.log(`   ✅ Asset class table RPC successful: ${data.length} rows`);
    
    // Check if scores are present
    const fundsWithScores = data.filter(row => !row.is_benchmark && row.score_final !== null);
    const benchmarks = data.filter(row => row.is_benchmark);
    
    console.log(`   📊 Funds with scores: ${fundsWithScores.length}`);
    console.log(`   📊 Benchmarks: ${benchmarks.length}`);

    if (fundsWithScores.length > 0) {
      const sample = fundsWithScores[0];
      console.log(`   📋 Sample fund: ${sample.ticker} - Score: ${sample.score_final}, Percentile: ${sample.percentile}`);
    }

    return true;
  } catch (error) {
    console.log(`   ❌ Asset class table test failed: ${error.message}`);
    return false;
  }
}

/**
 * Test feature flag environment variable
 */
function testFeatureFlag() {
  console.log('\n🚩 Testing feature flag configuration...');
  
  const flagValue = process.env.REACT_APP_DB_SCORES;
  console.log(`   📋 REACT_APP_DB_SCORES = ${flagValue || 'undefined'}`);
  
  if (flagValue === 'true') {
    console.log('   ✅ Feature flag is ENABLED - server-side scoring should be active');
  } else if (flagValue === 'false') {
    console.log('   ✅ Feature flag is DISABLED - client-side scoring should be active');
  } else {
    console.log('   ⚠️  Feature flag is not set - defaulting to client-side scoring');
  }
  
  return true;
}

/**
 * Test database connectivity
 */
async function testDatabaseConnectivity() {
  console.log('\n🔌 Testing database connectivity...');
  
  try {
    // Test basic table access
    const { data, error } = await supabase
      .from('funds')
      .select('ticker, name')
      .limit(1);

    if (error) {
      console.log(`   ❌ Database connection failed: ${error.message}`);
      return false;
    }

    console.log(`   ✅ Database connection successful`);
    console.log(`   📊 Sample fund: ${data?.[0]?.ticker || 'N/A'}`);
    
    return true;
  } catch (error) {
    console.log(`   ❌ Database test failed: ${error.message}`);
    return false;
  }
}

/**
 * Main test function
 */
async function runIntegrationTests() {
  try {
    console.log('🚀 Starting integration tests...\n');

    // Test 1: Database connectivity
    const dbTest = await testDatabaseConnectivity();
    
    // Test 2: Feature flag configuration
    const flagTest = testFeatureFlag();
    
    // Test 3: Server-side scoring RPC
    const scoringTest = await testServerScoringRPC();
    
    // Test 4: Asset class table RPC
    const tableTest = await testAssetClassTableRPC();

    // Summary
    console.log('\n📊 INTEGRATION TEST SUMMARY');
    console.log('='.repeat(40));
    console.log(`   Database Connectivity: ${dbTest ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Feature Flag Config: ${flagTest ? '✅ PASS' : '❌ PASS'}`);
    console.log(`   Server Scoring RPC: ${scoringTest ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Asset Class Table: ${tableTest ? '✅ PASS' : '❌ FAIL'}`);

    const allTestsPassed = dbTest && flagTest && scoringTest && tableTest;
    
    if (allTestsPassed) {
      console.log('\n🎉 ALL TESTS PASSED!');
      console.log('\n📋 Next steps:');
      console.log('   1. Set REACT_APP_DB_SCORES=true in your .env.local');
      console.log('   2. Restart your React application');
      console.log('   3. Check browser console for "server-side scoring" messages');
      console.log('   4. Run validation script: node scripts/validateServerScoring.js');
      
      process.exit(0);
    } else {
      console.log('\n❌ SOME TESTS FAILED');
      console.log('\n🔧 Troubleshooting:');
      console.log('   1. Check database migrations are applied');
      console.log('   2. Verify Supabase credentials in .env.local');
      console.log('   3. Check database function permissions');
      
      process.exit(1);
    }

  } catch (error) {
    console.error('\n💥 Integration tests failed with error:', error);
    process.exit(1);
  }
}

// Run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runIntegrationTests();
}

export { runIntegrationTests }; 