#!/usr/bin/env node

/**
 * Validation script for server-side scoring migration
 * Compares server-side vs client-side scores to ensure exact mathematical behavior
 * 
 * Usage: node scripts/validateServerScoring.js [--asset-class-id=uuid] [--date=YYYY-MM-DD]
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
let assetClassId = null;
let testDate = null;

args.forEach(arg => {
  if (arg.startsWith('--asset-class-id=')) {
    assetClassId = arg.split('=')[1];
  } else if (arg.startsWith('--date=')) {
    testDate = arg.split('=')[1];
  }
});

// Default to current date if not specified
if (!testDate) {
  testDate = new Date().toISOString().split('T')[0];
}

console.log(`🔍 Validating server-side scoring for date: ${testDate}`);
if (assetClassId) {
  console.log(`📊 Asset Class ID: ${assetClassId}`);
} else {
  console.log(`📊 All asset classes`);
}

/**
 * Fetch funds data from database
 */
async function fetchFundsData(date, assetClassId = null) {
  try {
    let query = supabase
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
      .eq('fund_performance.date', date);

    if (assetClassId) {
      query = query.eq('asset_class_id', assetClassId);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    // Transform to match expected format
    return data.map(fund => {
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
  } catch (error) {
    console.error('❌ Error fetching funds data:', error);
    throw error;
  }
}

/**
 * Get server-side scores from database RPC
 */
async function getServerScores(date, assetClassId = null) {
  try {
    const { data, error } = await supabase.rpc('calculate_scores_as_of', {
      p_date: date,
      p_asset_class_id: assetClassId
    });

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('❌ Error fetching server scores:', error);
    throw error;
  }
}

/**
 * Calculate client-side scores using existing algorithm
 */
function getClientScores(funds) {
  try {
    return calculateScores(funds);
  } catch (error) {
    console.error('❌ Error calculating client scores:', error);
    throw error;
  }
}

/**
 * Compare scores and generate validation report
 */
function compareScores(clientScores, serverScores) {
  const comparison = [];
  let totalFunds = 0;
  let exactMatches = 0;
  let withinTolerance = 0;
  let significantDifferences = 0;
  let errors = 0;

  // Create lookup maps
  const clientScoreMap = new Map();
  const serverScoreMap = new Map();

  clientScores.forEach(fund => {
    if (fund.scores && fund.scores.final !== undefined) {
      clientScoreMap.set(fund.ticker, fund.scores);
    }
  });

  serverScores.forEach(fund => {
    if (fund.score_final !== undefined) {
      serverScoreMap.set(fund.ticker, {
        final: fund.score_final,
        raw: fund.score_raw,
        percentile: fund.percentile
      });
    }
  });

  // Compare each fund
  const allTickers = new Set([...clientScoreMap.keys(), ...serverScoreMap.keys()]);

  allTickers.forEach(ticker => {
    const clientScore = clientScoreMap.get(ticker);
    const serverScore = serverScoreMap.get(ticker);

    if (!clientScore || !serverScore) {
      comparison.push({
        ticker,
        status: 'missing',
        clientScore: clientScore?.final || 'N/A',
        serverScore: serverScore?.final || 'N/A',
        difference: 'N/A',
        note: clientScore ? 'Missing server score' : 'Missing client score'
      });
      errors++;
      return;
    }

    const difference = Math.abs(clientScore.final - serverScore.final);
    const isExact = difference === 0;
    const isWithinTolerance = difference <= 0.1; // 0.1 point tolerance

    if (isExact) {
      exactMatches++;
    } else if (isWithinTolerance) {
      withinTolerance++;
    } else {
      significantDifferences++;
    }

    comparison.push({
      ticker,
      status: isExact ? 'exact' : isWithinTolerance ? 'tolerance' : 'significant',
      clientScore: clientScore.final,
      serverScore: serverScore.final,
      difference: difference.toFixed(3),
      note: isExact ? 'Perfect match' : isWithinTolerance ? 'Within tolerance' : 'Significant difference'
    });

    totalFunds++;
  });

  return {
    comparison,
    summary: {
      totalFunds,
      exactMatches,
      withinTolerance,
      significantDifferences,
      errors
    }
  };
}

/**
 * Generate detailed validation report
 */
function generateReport(validation, clientScores, serverScores) {
  console.log('\n📊 VALIDATION REPORT');
  console.log('='.repeat(50));

  // Summary
  const { summary } = validation;
  console.log(`\n📈 SUMMARY:`);
  console.log(`   Total Funds: ${summary.totalFunds}`);
  console.log(`   Exact Matches: ${summary.exactMatches} (${((summary.exactMatches / summary.totalFunds) * 100).toFixed(1)}%)`);
  console.log(`   Within Tolerance (≤0.1): ${summary.withinTolerance} (${((summary.withinTolerance / summary.totalFunds) * 100).toFixed(1)}%)`);
  console.log(`   Significant Differences (>0.1): ${summary.significantDifferences} (${((summary.significantDifferences / summary.totalFunds) * 100).toFixed(1)}%)`);
  console.log(`   Errors: ${summary.errors}`);

  // Overall status
  const successRate = ((summary.exactMatches + summary.withinTolerance) / summary.totalFunds) * 100;
  if (successRate >= 99.9) {
    console.log('\n✅ VALIDATION PASSED: Server-side scoring matches client-side within tolerance');
  } else if (successRate >= 95) {
    console.log('\n⚠️  VALIDATION WARNING: Most scores match, but some significant differences detected');
  } else {
    console.log('\n❌ VALIDATION FAILED: Too many significant differences detected');
  }

  // Show significant differences
  if (summary.significantDifferences > 0) {
    console.log('\n🔍 SIGNIFICANT DIFFERENCES (>0.1 points):');
    validation.comparison
      .filter(item => item.status === 'significant')
      .forEach(item => {
        console.log(`   ${item.ticker}: Client=${item.clientScore}, Server=${item.serverScore}, Diff=${item.difference}`);
      });
  }

  // Show errors
  if (summary.errors > 0) {
    console.log('\n❌ ERRORS:');
    validation.comparison
      .filter(item => item.status === 'missing')
      .forEach(item => {
        console.log(`   ${item.ticker}: ${item.note}`);
      });
  }

  // Performance comparison
  console.log('\n⚡ PERFORMANCE COMPARISON:');
  console.log(`   Client-side scoring: ${clientScores.length} funds processed`);
  console.log(`   Server-side scoring: ${serverScores.length} funds processed`);
}

/**
 * Main validation function
 */
async function validateServerScoring() {
  try {
    console.log('🚀 Starting server-side scoring validation...\n');

    // Step 1: Fetch funds data
    console.log('📥 Fetching funds data...');
    const funds = await fetchFundsData(testDate, assetClassId);
    console.log(`   Found ${funds.length} funds`);

    if (funds.length === 0) {
      console.log('❌ No funds found for the specified criteria');
      return;
    }

    // Step 2: Calculate client-side scores
    console.log('\n🧮 Calculating client-side scores...');
    const startTime = Date.now();
    const clientScores = getClientScores(funds);
    const clientTime = Date.now() - startTime;
    console.log(`   Completed in ${clientTime}ms`);

    // Step 3: Get server-side scores
    console.log('\n🖥️  Fetching server-side scores...');
    const startTime2 = Date.now();
    const serverScores = await getServerScores(testDate, assetClassId);
    const serverTime = Date.now() - startTime2;
    console.log(`   Completed in ${serverTime}ms`);

    // Step 4: Compare scores
    console.log('\n🔍 Comparing scores...');
    const validation = compareScores(clientScores, serverScores);

    // Step 5: Generate report
    generateReport(validation, clientScores, serverScores);

    // Performance summary
    console.log('\n📊 PERFORMANCE SUMMARY:');
    console.log(`   Client-side: ${clientTime}ms (${(clientTime / funds.length).toFixed(2)}ms per fund)`);
    console.log(`   Server-side: ${serverTime}ms (${(serverTime / funds.length).toFixed(2)}ms per fund)`);
    console.log(`   Speedup: ${(clientTime / serverTime).toFixed(2)}x`);

    // Exit with appropriate code
    const successRate = ((validation.summary.exactMatches + validation.summary.withinTolerance) / validation.summary.totalFunds) * 100;
    if (successRate >= 99.9) {
      process.exit(0);
    } else {
      process.exit(1);
    }

  } catch (error) {
    console.error('\n💥 Validation failed with error:', error);
    process.exit(1);
  }
}

// Run validation if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  validateServerScoring();
}

export { validateServerScoring }; 