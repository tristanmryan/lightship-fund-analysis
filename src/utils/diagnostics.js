import { supabase } from '../config/supabaseClient.js';

export async function runDiagnostics() {
  console.log('=== DATABASE DIAGNOSTICS ===');
  
  // Test essential database connectivity only
  // Legacy RPC functions have been replaced by fundDataService
  console.log('Skipping legacy RPC tests - using fundDataService instead');
  
  // Check table access
  const tables = ['funds', 'fund_performance', 'client_holdings'];
  for (const table of tables) {
    try {
      const { error } = await supabase.from(table).select('*').limit(1);
      console.log(`Table ${table}: ${error ? 'FAILED' : 'SUCCESS'}`);
    } catch (e) {
      console.log(`Table ${table}: ERROR`);
    }
  }
}
