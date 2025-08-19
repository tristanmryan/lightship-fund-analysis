// Real Fund Data Import Script
// This script imports the real fund data from CSV files into Supabase

import Papa from 'papaparse';
import fs from 'fs';
import path from 'path';
import { supabase, TABLES } from '../services/supabase.js';

// File paths
const DATA_DIR = path.join(process.cwd(), 'src/data/real-data');
const BENCHMARKS_FILE = path.join(DATA_DIR, 'Benchmarks.csv');
const REC_FUNDS_FILE = path.join(DATA_DIR, 'RecListFunds.csv');
const NON_REC_FUNDS_FILE = path.join(DATA_DIR, 'NonRecListFunds.csv');

// Helper function to read CSV file
function readCSVFile(filePath) {
  return new Promise((resolve, reject) => {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data),
      error: (error) => reject(error)
    });
  });
}

// Clear existing data
async function clearExistingData() {
  console.log('Clearing existing sample data...');
  
  try {
    // Clear asset class benchmarks first (due to foreign key constraints)
    await supabase.from(TABLES.ASSET_CLASS_BENCHMARKS).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    // Clear benchmarks
    await supabase.from(TABLES.BENCHMARKS).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    // Clear funds
    await supabase.from(TABLES.FUNDS).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    console.log('✓ Existing data cleared');
  } catch (error) {
    console.error('Error clearing data:', error);
    throw error;
  }
}

// Import benchmarks
async function importBenchmarks() {
  console.log('Importing benchmarks...');
  
  try {
    const benchmarkData = await readCSVFile(BENCHMARKS_FILE);
    console.log(`Found ${benchmarkData.length} benchmarks to import`);
    
    // Get all asset classes
    const { data: assetClasses } = await supabase
      .from(TABLES.ASSET_CLASSES)
      .select('id, name');
    
    const assetClassMap = new Map(
      assetClasses.map(ac => [ac.name.toLowerCase(), ac])
    );
    
    let imported = 0;
    let errors = [];
    
    for (const row of benchmarkData) {
      try {
        const assetClass = row['Asset Class']?.trim();
        const ticker = row['Chosen ETF Ticker']?.trim().toUpperCase();
        const name = row['Benchmark Name']?.trim();
        
        if (!assetClass || !ticker || !name) {
          errors.push(`Skipping row with missing data: ${JSON.stringify(row)}`);
          continue;
        }
        
        // Find matching asset class
        const ac = assetClassMap.get(assetClass.toLowerCase());
        if (!ac) {
          errors.push(`Asset class not found: ${assetClass}`);
          continue;
        }
        
        // Insert benchmark
        const { data: benchmark, error: benchmarkError } = await supabase
          .from(TABLES.BENCHMARKS)
          .insert({
            ticker: ticker,
            name: name,
            is_active: true
          })
          .select()
          .single();
        
        if (benchmarkError) {
          errors.push(`Error inserting benchmark ${ticker}: ${benchmarkError.message}`);
          continue;
        }
        
        // Create asset class mapping
        const { error: mappingError } = await supabase
          .from(TABLES.ASSET_CLASS_BENCHMARKS)
          .insert({
            asset_class_id: ac.id,
            benchmark_id: benchmark.id,
            kind: 'primary',
            rank: 1
          });
        
        if (mappingError) {
          errors.push(`Error creating mapping for ${ticker}: ${mappingError.message}`);
          continue;
        }
        
        imported++;
        console.log(`✓ Imported benchmark: ${ticker} (${name}) for ${assetClass}`);
        
      } catch (error) {
        errors.push(`Error processing benchmark row: ${error.message}`);
      }
    }
    
    console.log(`✓ Benchmarks imported: ${imported} successful, ${errors.length} errors`);
    if (errors.length > 0) {
      console.log('Benchmark import errors:', errors);
    }
    
    return { imported, errors };
    
  } catch (error) {
    console.error('Error importing benchmarks:', error);
    throw error;
  }
}

// Import recommended funds
async function importRecommendedFunds() {
  console.log('Importing recommended funds...');
  
  try {
    const fundData = await readCSVFile(REC_FUNDS_FILE);
    console.log(`Found ${fundData.length} recommended funds to import`);
    
    // Get all asset classes
    const { data: assetClasses } = await supabase
      .from(TABLES.ASSET_CLASSES)
      .select('id, name');
    
    const assetClassMap = new Map(
      assetClasses.map(ac => [ac.name.toLowerCase(), ac])
    );
    
    let imported = 0;
    let errors = [];
    
    for (const row of fundData) {
      try {
        const ticker = row['Fund Ticker']?.trim().toUpperCase();
        const name = row['Fund Name']?.trim();
        const assetClass = row['Asset Class']?.trim();
        
        if (!ticker || !name || !assetClass) {
          errors.push(`Skipping row with missing data: ${JSON.stringify(row)}`);
          continue;
        }
        
        // Find matching asset class
        const ac = assetClassMap.get(assetClass.toLowerCase());
        if (!ac) {
          errors.push(`Asset class not found for ${ticker}: ${assetClass}`);
          continue;
        }
        
        // Insert fund
        const { error: fundError } = await supabase
          .from(TABLES.FUNDS)
          .insert({
            ticker: ticker,
            name: name,
            asset_class: assetClass,
            is_recommended: true,
            added_date: new Date().toISOString(),
            last_updated: new Date().toISOString()
          });
        
        if (fundError) {
          errors.push(`Error inserting fund ${ticker}: ${fundError.message}`);
          continue;
        }
        
        imported++;
        console.log(`✓ Imported recommended fund: ${ticker} (${name}) - ${assetClass}`);
        
      } catch (error) {
        errors.push(`Error processing fund row: ${error.message}`);
      }
    }
    
    console.log(`✓ Recommended funds imported: ${imported} successful, ${errors.length} errors`);
    if (errors.length > 0) {
      console.log('Recommended fund import errors:', errors);
    }
    
    return { imported, errors };
    
  } catch (error) {
    console.error('Error importing recommended funds:', error);
    throw error;
  }
}

// Import non-recommended funds
async function importNonRecommendedFunds() {
  console.log('Importing non-recommended funds...');
  
  try {
    const fundData = await readCSVFile(NON_REC_FUNDS_FILE);
    console.log(`Found ${fundData.length} non-recommended funds to import`);
    
    // Get all asset classes
    const { data: assetClasses } = await supabase
      .from(TABLES.ASSET_CLASSES)
      .select('id, name');
    
    const assetClassMap = new Map(
      assetClasses.map(ac => [ac.name.toLowerCase(), ac])
    );
    
    let imported = 0;
    let errors = [];
    
    for (const row of fundData) {
      try {
        const ticker = row['Symbol']?.trim().toUpperCase();
        const name = row['Product Description']?.trim();
        const assetClass = row['Asset Class']?.trim();
        
        if (!ticker || !name || !assetClass) {
          errors.push(`Skipping row with missing data: ${JSON.stringify(row)}`);
          continue;
        }
        
        // Find matching asset class
        const ac = assetClassMap.get(assetClass.toLowerCase());
        if (!ac) {
          errors.push(`Asset class not found for ${ticker}: ${assetClass}`);
          continue;
        }
        
        // Insert fund
        const { error: fundError } = await supabase
          .from(TABLES.FUNDS)
          .insert({
            ticker: ticker,
            name: name,
            asset_class: assetClass,
            is_recommended: false,
            added_date: new Date().toISOString(),
            last_updated: new Date().toISOString()
          });
        
        if (fundError) {
          errors.push(`Error inserting fund ${ticker}: ${fundError.message}`);
          continue;
        }
        
        imported++;
        console.log(`✓ Imported non-recommended fund: ${ticker} (${name}) - ${assetClass}`);
        
      } catch (error) {
        errors.push(`Error processing fund row: ${error.message}`);
      }
    }
    
    console.log(`✓ Non-recommended funds imported: ${imported} successful, ${errors.length} errors`);
    if (errors.length > 0) {
      console.log('Non-recommended fund import errors:', errors);
    }
    
    return { imported, errors };
    
  } catch (error) {
    console.error('Error importing non-recommended funds:', error);
    throw error;
  }
}

// Validate imports
async function validateImports() {
  console.log('Validating imports...');
  
  try {
    // Count benchmarks
    const { count: benchmarkCount } = await supabase
      .from(TABLES.BENCHMARKS)
      .select('*', { count: 'exact' });
    
    // Count recommended funds
    const { count: recFundCount } = await supabase
      .from(TABLES.FUNDS)
      .select('*', { count: 'exact' })
      .eq('is_recommended', true);
    
    // Count non-recommended funds
    const { count: nonRecFundCount } = await supabase
      .from(TABLES.FUNDS)
      .select('*', { count: 'exact' })
      .eq('is_recommended', false);
    
    // Count asset class mappings
    const { count: mappingCount } = await supabase
      .from(TABLES.ASSET_CLASS_BENCHMARKS)
      .select('*', { count: 'exact' });
    
    console.log('✓ Import validation results:');
    console.log(`  - Benchmarks: ${benchmarkCount}`);
    console.log(`  - Recommended funds: ${recFundCount}`);
    console.log(`  - Non-recommended funds: ${nonRecFundCount}`);
    console.log(`  - Total funds: ${recFundCount + nonRecFundCount}`);
    console.log(`  - Asset class mappings: ${mappingCount}`);
    
    // Expected counts
    const expectedBenchmarks = 32;
    const expectedRecFunds = 107;
    const expectedNonRecFunds = 42;
    const expectedTotalFunds = 149;
    
    const success = (
      benchmarkCount === expectedBenchmarks &&
      recFundCount === expectedRecFunds &&
      nonRecFundCount === expectedNonRecFunds &&
      (recFundCount + nonRecFundCount) === expectedTotalFunds
    );
    
    if (success) {
      console.log('✅ All imports completed successfully!');
    } else {
      console.log('⚠️  Import counts do not match expected values:');
      console.log(`  Expected: ${expectedBenchmarks} benchmarks, ${expectedRecFunds} rec funds, ${expectedNonRecFunds} non-rec funds`);
    }
    
    return {
      benchmarkCount,
      recFundCount,
      nonRecFundCount,
      totalFunds: recFundCount + nonRecFundCount,
      mappingCount,
      success
    };
    
  } catch (error) {
    console.error('Error validating imports:', error);
    throw error;
  }
}

// Main import function
async function importRealData() {
  console.log('🚀 Starting real fund data import...');
  
  try {
    // Clear existing data
    await clearExistingData();
    
    // Import benchmarks
    const benchmarkResults = await importBenchmarks();
    
    // Import recommended funds
    const recFundResults = await importRecommendedFunds();
    
    // Import non-recommended funds
    const nonRecFundResults = await importNonRecommendedFunds();
    
    // Validate imports
    const validation = await validateImports();
    
    console.log('📊 Import Summary:');
    console.log(`  - Benchmarks: ${benchmarkResults.imported} imported, ${benchmarkResults.errors.length} errors`);
    console.log(`  - Recommended funds: ${recFundResults.imported} imported, ${recFundResults.errors.length} errors`);
    console.log(`  - Non-recommended funds: ${nonRecFundResults.imported} imported, ${nonRecFundResults.errors.length} errors`);
    console.log(`  - Validation: ${validation.success ? 'PASSED' : 'FAILED'}`);
    
    if (validation.success) {
      console.log('✅ Real fund data import completed successfully!');
      console.log('🎯 Ready for professional launch with real data');
    } else {
      console.log('❌ Import completed with issues - please review errors above');
    }
    
    return validation;
    
  } catch (error) {
    console.error('❌ Fatal error during import:', error);
    throw error;
  }
}

// Export for use in other modules
export {
  importRealData,
  importBenchmarks,
  importRecommendedFunds,
  importNonRecommendedFunds,
  validateImports,
  clearExistingData
};

// If run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  importRealData()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}