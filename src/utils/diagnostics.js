import { supabase } from '../config/supabaseClient.js';

export async function runDiagnostics() {
  console.log('=== DATABASE DIAGNOSTICS ===');
  
  // Test which RPCs exist
  const rpcs = [
    'get_funds_as_of',
    'get_scores_as_of', 
    'calculate_scores_as_of',
    'get_asset_class_table',
    'get_fund_ownership_summary'
  ];
  
  for (const rpc of rpcs) {
    try {
      const { data, error } = await supabase.rpc(rpc, {
        p_as_of_date: '2024-12-31'
      });
      console.log(`RPC ${rpc}: ${error ? 'FAILED - ' + error.message : 'SUCCESS'}`);
      if (data && data[0]) {
        console.log(`  Sample data keys: ${Object.keys(data[0]).join(', ')}`);
      }
    } catch (e) {
      console.log(`RPC ${rpc}: ERROR - ${e.message}`);
    }
  }
  
  // Check table access
  const tables = ['funds', 'fund_performance', 'client_holdings'];
  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select('*').limit(1);
      console.log(`Table ${table}: ${error ? 'FAILED' : 'SUCCESS'}`);
    } catch (e) {
      console.log(`Table ${table}: ERROR`);
    }
  }
}
