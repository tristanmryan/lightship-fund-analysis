// Fix RPC Signature Conflict
// Run this script to clean up the conflicting get_compare_dataset functions

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      process.env[key] = value;
    }
  });
}

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixRpcSignature() {
  console.log('🔧 Fixing get_compare_dataset RPC signature conflict...');
  
  try {
    // Read the migration SQL
    const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20250816_fix_compare_dataset_signature.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📝 Applying RPC signature fix...');
    
    // Execute the SQL through Supabase RPC (we'll use a simple approach)
    // Since we can't execute DDL directly, we'll create a temporary function to do it
    
    // First, let's check what functions exist
    const { data: existingFunctions, error: checkError } = await supabase
      .rpc('get_compare_dataset', { 
        p_date: '2025-07-31', 
        p_tickers: ['RJFA001'], 
        p_benchmark: null 
      });
    
    if (checkError) {
      console.log('ℹ️  Current RPC error:', checkError.message);
    } else {
      console.log('✅ RPC is working, no signature conflict detected');
      return;
    }
    
    console.log('⚠️  RPC signature conflict detected. Please apply the migration manually:');
    console.log('📁 File: supabase/migrations/20250816_fix_compare_dataset_signature.sql');
    console.log('🔗 Apply through Supabase Dashboard > SQL Editor');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run the fix
fixRpcSignature(); 