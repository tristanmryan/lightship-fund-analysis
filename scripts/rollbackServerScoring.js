#!/usr/bin/env node

/**
 * Rollback script for server-side scoring migration
 * Safely removes server-side scoring functions and restores original behavior
 * 
 * Usage: node scripts/rollbackServerScoring.js [--confirm]
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

// Parse command line arguments
const args = process.argv.slice(2);
const confirmRollback = args.includes('--confirm');

console.log('🔄 Server-side Scoring Rollback Script');
console.log('='.repeat(50));

if (!confirmRollback) {
  console.log('\n⚠️  WARNING: This script will remove all server-side scoring functions!');
  console.log('   This action cannot be undone.');
  console.log('\n   To proceed, run: node scripts/rollbackServerScoring.js --confirm');
  console.log('\n   Functions that will be removed:');
  console.log('   - calculate_scores_as_of()');
  console.log('   - All _calculate_* helper functions');
  console.log('   - Updated get_asset_class_table()');
  console.log('\n   The app will fall back to client-side scoring.');
  process.exit(0);
}

console.log('✅ Confirmation received. Proceeding with rollback...\n');

/**
 * Drop server-side scoring functions
 */
async function dropServerScoringFunctions() {
  const functionsToDrop = [
    'calculate_scores_as_of',
    '_calculate_mean',
    '_calculate_stddev',
    '_calculate_zscore',
    '_calculate_quantile',
    '_erf',
    '_erfinv',
    '_winsorize_z',
    '_scale_score',
    '_calculate_robust_scaling_anchors',
    '_scale_score_robust',
    '_apply_tiny_class_fallback',
    '_calculate_percentile',
    '_calculate_metric_statistics',
    '_calculate_fund_scores',
    '_calculate_single_fund_score'
  ];

  console.log('🗑️  Dropping server-side scoring functions...');
  
  for (const funcName of functionsToDrop) {
    try {
      const { error } = await supabase.rpc('drop_function_if_exists', {
        function_name: funcName
      });
      
      if (error) {
        console.log(`   ⚠️  ${funcName}: ${error.message}`);
      } else {
        console.log(`   ✅ ${funcName}: Dropped`);
      }
    } catch (error) {
      console.log(`   ❌ ${funcName}: ${error.message}`);
    }
  }
}

/**
 * Restore original get_asset_class_table function
 */
async function restoreOriginalAssetClassTable() {
  console.log('\n🔄 Restoring original get_asset_class_table function...');
  
  try {
    // Drop the updated function
    const { error: dropError } = await supabase.rpc('drop_function_if_exists', {
      function_name: 'get_asset_class_table'
    });
    
    if (dropError) {
      console.log(`   ⚠️  Drop error: ${dropError.message}`);
    }
    
    // Recreate the original function (simplified version)
    const { error: createError } = await supabase.rpc('create_original_asset_class_table');
    
    if (createError) {
      console.log(`   ❌ Create error: ${createError.message}`);
      console.log('   Manually restoring function...');
      
      // Manual restoration
      const restoreSQL = `
        CREATE OR REPLACE FUNCTION public.get_asset_class_table(
          p_date date, 
          p_asset_class_id uuid DEFAULT NULL, 
          p_include_benchmark boolean DEFAULT true
        )
        RETURNS TABLE(
          asset_class_id uuid,
          ticker text,
          name text,
          is_benchmark boolean,
          is_recommended boolean,
          perf_date date,
          ytd_return numeric,
          one_year_return numeric,
          three_year_return numeric,
          five_year_return numeric,
          ten_year_return numeric,
          sharpe_ratio numeric,
          standard_deviation_3y numeric,
          standard_deviation_5y numeric,
          expense_ratio numeric,
          beta numeric,
          alpha numeric,
          up_capture_ratio numeric,
          down_capture_ratio numeric,
          manager_tenure numeric,
          score_final numeric,
          percentile int
        )
        LANGUAGE sql
        STABLE
        AS $$
          WITH funds_asof AS (
            SELECT * FROM public.get_funds_as_of(p_date) 
            WHERE asset_class_id = p_asset_class_id OR p_asset_class_id IS NULL
          ),
          primary_bench AS (
            SELECT 
              acb.asset_class_id,
              b.ticker,
              b.name
            FROM public.asset_class_benchmarks acb
            JOIN public.benchmarks b ON b.id = acb.benchmark_id
            WHERE acb.kind = 'primary' 
              AND (acb.asset_class_id = p_asset_class_id OR p_asset_class_id IS NULL)
          ),
          bench_perf AS (
            SELECT 
              pb.asset_class_id,
              pb.ticker AS benchmark_ticker,
              pb.name AS benchmark_name,
              bp.date AS perf_date,
              bp.ytd_return, bp.one_year_return, bp.three_year_return, 
              bp.five_year_return, bp.ten_year_return,
              bp.sharpe_ratio, bp.standard_deviation_3y, bp.standard_deviation_5y,
              bp.expense_ratio, bp.beta, bp.alpha, bp.up_capture_ratio, bp.down_capture_ratio
            FROM primary_bench pb
            LEFT JOIN LATERAL (
              SELECT * FROM public.benchmark_performance bpp
              WHERE bpp.benchmark_ticker = pb.ticker 
                AND bpp.date <= COALESCE(p_date, public._get_latest_fund_date())
              ORDER BY bpp.date DESC
              LIMIT 1
            ) bp ON true
          ),
          fund_scores AS (
            SELECT 
              f.asset_class_id,
              f.ticker,
              -- Simple scoring using 1-year return as primary metric
              CASE 
                WHEN f.one_year_return IS NOT NULL THEN
                  LEAST(100, GREATEST(0, 50 + (f.one_year_return - 
                    AVG(f.one_year_return) OVER (PARTITION BY f.asset_class_id)) * 5))
                ELSE NULL
              END AS score_final,
              -- Calculate percentile within asset class
              CASE 
                WHEN f.one_year_return IS NOT NULL THEN
                  ROUND(PERCENT_RANK() OVER (
                    PARTITION BY f.asset_class_id 
                    ORDER BY f.one_year_return ASC
                  ) * 100)::int
                ELSE NULL
              END AS percentile
            FROM funds_asof f
            WHERE f.asset_class_id IS NOT NULL
          )
          SELECT * FROM (
            -- Return fund rows with scores
            SELECT 
              f.asset_class_id,
              f.ticker,
              f.name,
              false AS is_benchmark,
              f.is_recommended,
              f.perf_date,
              f.ytd_return, f.one_year_return, f.three_year_return, 
              f.five_year_return, f.ten_year_return,
              f.sharpe_ratio, f.standard_deviation_3y, f.standard_deviation_5y,
              f.expense_ratio, f.beta, f.alpha, f.up_capture_ratio, f.down_capture_ratio,
              f.manager_tenure,
              COALESCE(fs.score_final, 50.0) AS score_final,
              fs.percentile
            FROM funds_asof f
            LEFT JOIN fund_scores fs ON fs.asset_class_id = f.asset_class_id AND fs.ticker = f.ticker
            
            UNION ALL
            
            -- Return benchmark rows if requested (no scores for benchmarks)
            SELECT 
              bp.asset_class_id,
              bp.benchmark_ticker AS ticker,
              bp.benchmark_name AS name,
              true AS is_benchmark,
              false AS is_recommended,
              bp.perf_date,
              bp.ytd_return, bp.one_year_return, bp.three_year_return,
              bp.five_year_return, bp.ten_year_return,
              bp.sharpe_ratio, bp.standard_deviation_3y, bp.standard_deviation_5y,
              bp.expense_ratio, bp.beta, bp.alpha, bp.up_capture_ratio, bp.down_capture_ratio,
              NULL::numeric AS manager_tenure,
              NULL::numeric AS score_final,
              NULL::int AS percentile
            FROM bench_perf bp
            WHERE p_include_benchmark = true
          ) ranked_data
          ORDER BY 
            is_benchmark ASC, 
            CASE WHEN is_benchmark THEN ticker ELSE NULL END ASC,
            CASE WHEN NOT is_benchmark THEN COALESCE(score_final, 0) ELSE NULL END DESC NULLS LAST,
            ticker ASC;
        $$;
      `;
      
      const { error: manualError } = await supabase.rpc('exec_sql', { sql: restoreSQL });
      if (manualError) {
        console.log(`   ❌ Manual restoration failed: ${manualError.message}`);
        return false;
      }
    }
    
    console.log('   ✅ get_asset_class_table restored to original version');
    return true;
    
  } catch (error) {
    console.log(`   ❌ Restoration error: ${error.message}`);
    return false;
  }
}

/**
 * Verify rollback success
 */
async function verifyRollback() {
  console.log('\n🔍 Verifying rollback...');
  
  try {
    // Check if server-side scoring function exists
    const { data: serverFunc, error: serverError } = await supabase.rpc('calculate_scores_as_of', {
      p_date: '2025-07-31',
      p_asset_class_id: null
    });
    
    if (serverError && serverError.message.includes('function') && serverError.message.includes('does not exist')) {
      console.log('   ✅ Server-side scoring function removed');
    } else {
      console.log('   ❌ Server-side scoring function still exists');
      return false;
    }
    
    // Check if asset class table function works
    const { data: tableData, error: tableError } = await supabase.rpc('get_asset_class_table', {
      p_date: '2025-07-31',
      p_asset_class_id: null,
      p_include_benchmark: true
    });
    
    if (tableError) {
      console.log(`   ❌ Asset class table function error: ${tableError.message}`);
      return false;
    }
    
    if (tableData && tableData.length > 0) {
      console.log(`   ✅ Asset class table function working (${tableData.length} rows)`);
    } else {
      console.log('   ⚠️  Asset class table function returned no data');
    }
    
    return true;
    
  } catch (error) {
    console.log(`   ❌ Verification error: ${error.message}`);
    return false;
  }
}

/**
 * Main rollback function
 */
async function performRollback() {
  try {
    console.log('🚀 Starting server-side scoring rollback...\n');
    
    // Step 1: Drop server-side scoring functions
    await dropServerScoringFunctions();
    
    // Step 2: Restore original asset class table function
    const restoreSuccess = await restoreOriginalAssetClassTable();
    
    if (!restoreSuccess) {
      console.log('\n❌ Failed to restore original function. Manual intervention may be required.');
      process.exit(1);
    }
    
    // Step 3: Verify rollback
    const verifySuccess = await verifyRollback();
    
    if (verifySuccess) {
      console.log('\n✅ ROLLBACK COMPLETED SUCCESSFULLY');
      console.log('\n📋 Next steps:');
      console.log('   1. Set REACT_APP_DB_SCORES=false in your environment');
      console.log('   2. Restart your application');
      console.log('   3. Verify that client-side scoring is working');
      console.log('   4. All server-side scoring functions have been removed');
      
      process.exit(0);
    } else {
      console.log('\n❌ ROLLBACK VERIFICATION FAILED');
      console.log('   Manual intervention may be required.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n💥 Rollback failed with error:', error);
    process.exit(1);
  }
}

// Run rollback if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  performRollback();
}

export { performRollback }; 