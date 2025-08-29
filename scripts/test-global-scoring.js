#!/usr/bin/env node

import dotenv from 'dotenv';
import fundService from '../src/services/fundService.js';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function loadDashboard(asOf = null) {
  console.log('\n📊 Loading dashboard funds...');
  const funds = await fundService.getAllFundsWithServerScoring(asOf);
  console.log(`   Loaded ${funds.length} funds`);

  const scores = funds.map(f => f.scores?.final).filter(s => typeof s === 'number');
  if (scores.length) {
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    console.log(`   Score range: min=${min.toFixed(2)} max=${max.toFixed(2)} avg=${avg.toFixed(2)}`);
    console.log('   Sample scores:', scores.slice(0, 5).map(s => s.toFixed(2)).join(', '));
  } else {
    console.log('   No scores returned');
  }

  return funds;
}

async function compareAssetClass(asOf, assetClassId) {
  console.log(`\n🔎 Comparing scores for asset class ${assetClassId}...`);
  const tableRows = await fundService.getAssetClassTable(asOf, assetClassId, true);
  const tableMap = new Map(
    (tableRows || [])
      .filter(r => !r.is_benchmark)
      .map(r => [r.ticker, r.score_final])
  );

  const dashboardFunds = await fundService.getAllFundsWithServerScoring(asOf);
  const discrepancies = [];
  dashboardFunds
    .filter(f => f.asset_class_id === assetClassId)
    .forEach(f => {
      const dashScore = f.scores?.final;
      const tableScore = tableMap.get(f.ticker);
      if (
        typeof dashScore === 'number' &&
        typeof tableScore === 'number' &&
        Math.abs(dashScore - tableScore) > 0.0001
      ) {
        discrepancies.push({ ticker: f.ticker, dashboard: dashScore, table: tableScore });
      }
    });

  if (discrepancies.length) {
    console.log('   ❌ Score discrepancies found:');
    discrepancies.forEach(d =>
      console.log(`      ${d.ticker} dashboard=${d.dashboard} table=${d.table}`)
    );
  } else {
    console.log('   ✅ Scores match between dashboard and asset class table');
  }
}

async function testRpc(asOf = null) {
  console.log('\n🧪 Testing calculate_scores_as_of RPC...');
  const { supabase } = fundService;
  const { data, error } = await supabase.rpc('calculate_scores_as_of', {
    p_date: asOf,
    p_global: true
  });

  if (error) {
    console.log(`   ❌ RPC failed: ${error.message}`);
    return;
  }

  const scores = (data || []).map(r => r.score_final);
  const unique = new Set(scores.map(s => s.toFixed(2)));
  console.log(`   Returned ${scores.length} scores with ${unique.size} unique values`);
  console.log('   Sample RPC scores:', scores.slice(0, 5).map(s => s.toFixed(2)).join(', '));
}

async function main() {
  const funds = await loadDashboard();
  const sampleFund = funds.find(f => f.asset_class_id);
  if (sampleFund) {
    await compareAssetClass(null, sampleFund.asset_class_id);
  } else {
    console.log('\n⚠️ No funds with asset_class_id found for comparison');
  }
  await testRpc();
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});

