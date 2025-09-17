// Real Data Importer Component for Admin Panel
import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { supabase, TABLES } from '../../services/supabase';
import { Upload, RefreshCw, AlertCircle, CheckCircle, Info } from 'lucide-react';

const RealDataImporter = () => {
  const [importing, setImporting] = useState(false);
  const [step, setStep] = useState('ready'); // ready, clearing, importing, validating, complete
  const [results, setResults] = useState(null);
  const [errors, setErrors] = useState([]);
  const [progress, setProgress] = useState('');

  // CSV file contents (we'll read these from the file system via file inputs)
  const [benchmarkFile, setBenchmarkFile] = useState(null);
  const [recFundsFile, setRecFundsFile] = useState(null);
  const [nonRecFundsFile, setNonRecFundsFile] = useState(null);

  // Helper function to read CSV file
  const readCSVFile = (file) => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => resolve(results.data),
        error: (error) => reject(error)
      });
    });
  };

  // Load asset classes for validation
  const [assetClasses, setAssetClasses] = useState([]);
  
  useEffect(() => {
    loadAssetClasses();
  }, []);

  const loadAssetClasses = async () => {
    try {
      const { data, error } = await supabase
        .from(TABLES.ASSET_CLASSES)
        .select('id, name, code');
      
      if (error) throw error;
      setAssetClasses(data || []);
    } catch (error) {
      console.error('Error loading asset classes:', error);
    }
  };

  // Clear existing data
  const clearExistingData = async () => {
    setProgress('Clearing existing sample data...');
    
    try {
      // Clear asset class benchmarks first (due to foreign key constraints)
      await supabase.from(TABLES.ASSET_CLASS_BENCHMARKS).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      // Clear benchmarks
      await supabase.from(TABLES.BENCHMARKS).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      // Clear funds
      await supabase.from(TABLES.FUNDS).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      setProgress('✓ Existing data cleared');
    } catch (error) {
      throw new Error(`Error clearing data: ${error.message}`);
    }
  };

  // Import benchmarks
  const importBenchmarks = async (benchmarkData) => {
    setProgress('Importing benchmarks...');
    
    const assetClassMap = new Map(
      assetClasses.map(ac => [ac.name.toLowerCase(), ac])
    );
    
    let benchmarksCreated = 0;
    let mappingsCreated = 0;
    let errors = [];
    
    // First, create a map of unique benchmarks by ticker
    const uniqueBenchmarks = new Map();
    for (const row of benchmarkData) {
      const ticker = row['Chosen ETF Ticker']?.trim().toUpperCase();
      const name = row['Benchmark Name']?.trim();
      
      if (ticker && name) {
        uniqueBenchmarks.set(ticker, {
          ticker,
          name,
          assetClasses: []
        });
      }
    }
    
    // Group asset classes by benchmark ticker
    for (const row of benchmarkData) {
      const assetClass = row['Asset Class']?.trim();
      const ticker = row['Chosen ETF Ticker']?.trim().toUpperCase();
      
      if (assetClass && ticker && uniqueBenchmarks.has(ticker)) {
        uniqueBenchmarks.get(ticker).assetClasses.push(assetClass);
      }
    }
    
    // Now import unique benchmarks first
    for (const [ticker, benchmark] of uniqueBenchmarks) {
      try {
        // Use upsert to handle existing benchmarks
        const { data: benchmarkRecord, error: benchmarkError } = await supabase
          .from(TABLES.BENCHMARKS)
          .upsert({
            ticker: ticker,
            name: benchmark.name,
            is_active: true
          }, { 
            onConflict: 'ticker',
            ignoreDuplicates: false
          })
          .select()
          .single();
        
        if (benchmarkError) {
          errors.push(`Error upserting benchmark ${ticker}: ${benchmarkError.message}`);
          continue;
        }
        
        if (benchmarkRecord) {
          benchmarksCreated++;
          
          // Now create mappings for all asset classes that use this benchmark
          for (const assetClassName of benchmark.assetClasses) {
            try {
              const ac = assetClassMap.get(assetClassName.toLowerCase());
              if (!ac) {
                errors.push(`Asset class not found: ${assetClassName}`);
                continue;
              }
              
              // Check if mapping already exists
              const { data: existingMapping } = await supabase
                .from(TABLES.ASSET_CLASS_BENCHMARKS)
                .select('id')
                .eq('asset_class_id', ac.id)
                .eq('benchmark_id', benchmarkRecord.id)
                .eq('kind', 'primary')
                .maybeSingle();
              
              if (!existingMapping) {
                // Create new mapping
                const { error: mappingError } = await supabase
                  .from(TABLES.ASSET_CLASS_BENCHMARKS)
                  .insert({
                    asset_class_id: ac.id,
                    benchmark_id: benchmarkRecord.id,
                    kind: 'primary',
                    rank: 1
                  });
                
                if (mappingError) {
                  errors.push(`Error creating mapping for ${ticker} -> ${assetClassName}: ${mappingError.message}`);
                  continue;
                }
                
                mappingsCreated++;
              }
            } catch (error) {
              errors.push(`Error processing mapping for ${ticker} -> ${assetClassName}: ${error.message}`);
            }
          }
        }
        
      } catch (error) {
        errors.push(`Error processing benchmark ${ticker}: ${error.message}`);
      }
    }
    
    setProgress(`✓ Benchmarks: ${benchmarksCreated} unique benchmarks, ${mappingsCreated} asset class mappings, ${errors.length} errors`);
    return { imported: benchmarksCreated, mappings: mappingsCreated, errors };
  };

  // Import recommended funds
  const importRecommendedFunds = async (fundData) => {
    setProgress('Importing recommended funds...');
    
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
          errors.push(`Skipping recommended fund row with missing data`);
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
        
      } catch (error) {
        errors.push(`Error processing recommended fund row: ${error.message}`);
      }
    }
    
    setProgress(`✓ Recommended funds imported: ${imported} successful, ${errors.length} errors`);
    return { imported, errors };
  };

  // Import non-recommended funds
  const importNonRecommendedFunds = async (fundData) => {
    setProgress('Importing non-recommended funds...');
    
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
          errors.push(`Skipping non-recommended fund row with missing data`);
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
        
      } catch (error) {
        errors.push(`Error processing non-recommended fund row: ${error.message}`);
      }
    }
    
    setProgress(`✓ Non-recommended funds imported: ${imported} successful, ${errors.length} errors`);
    return { imported, errors };
  };

  // Validate imports
  const validateImports = async () => {
    setProgress('Validating imports...');
    
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
      
      const validation = {
        benchmarkCount,
        recFundCount,
        nonRecFundCount,
        totalFunds: recFundCount + nonRecFundCount,
        mappingCount
      };
      
      // Expected counts
      const expectedRecFunds = 107;
      const expectedNonRecFunds = 42;
      
      // For benchmarks, we expect fewer unique benchmarks than CSV rows due to duplicates
      // but we should have at least 20 unique benchmarks and 32 total mappings
      const expectedMinBenchmarks = 20;
      const expectedMappings = 32;
      
      validation.success = (
        benchmarkCount >= expectedMinBenchmarks &&
        mappingCount >= expectedMappings &&
        recFundCount === expectedRecFunds &&
        nonRecFundCount === expectedNonRecFunds
      );
      
      setProgress(validation.success ? '✅ Validation passed!' : '⚠️ Validation failed - check counts');
      return validation;
      
    } catch (error) {
      throw new Error(`Error validating imports: ${error.message}`);
    }
  };

  // Main import function
  const handleImport = async () => {
    if (!benchmarkFile || !recFundsFile || !nonRecFundsFile) {
      alert('Please select all three CSV files before importing');
      return;
    }

    setImporting(true);
    setStep('clearing');
    setErrors([]);
    setResults(null);
    
    try {
      // Clear existing data
      await clearExistingData();
      
      setStep('importing');
      
      // Read CSV files
      const benchmarkData = await readCSVFile(benchmarkFile);
      const recFundsData = await readCSVFile(recFundsFile);
      const nonRecFundsData = await readCSVFile(nonRecFundsFile);
      
      // Import data
      const benchmarkResults = await importBenchmarks(benchmarkData);
      const recFundResults = await importRecommendedFunds(recFundsData);
      const nonRecFundResults = await importNonRecommendedFunds(nonRecFundsData);
      
      setStep('validating');
      
      // Validate imports
      const validation = await validateImports();
      
      setStep('complete');
      
      // Compile results
      const allErrors = [
        ...benchmarkResults.errors,
        ...recFundResults.errors,
        ...nonRecFundResults.errors
      ];
      
      setResults({
        benchmarks: benchmarkResults.imported,
        benchmarkMappings: benchmarkResults.mappings || 0,
        recommendedFunds: recFundResults.imported,
        nonRecommendedFunds: nonRecFundResults.imported,
        totalFunds: recFundResults.imported + nonRecFundResults.imported,
        validation
      });
      
      setErrors(allErrors);
      setProgress('Import completed!');
      
    } catch (error) {
      setErrors([error.message]);
      setProgress(`Import failed: ${error.message}`);
      setStep('ready');
    } finally {
      setImporting(false);
    }
  };

  const getStepIcon = (currentStep) => {
    switch (currentStep) {
      case 'ready':
        return <Upload className="w-5 h-5" />;
      case 'clearing':
      case 'importing':
      case 'validating':
        return <RefreshCw className="w-5 h-5 animate-spin" />;
      case 'complete':
        return results?.validation?.success ? 
          <CheckCircle className="w-5 h-5 text-green-500" /> : 
          <AlertCircle className="w-5 h-5 text-yellow-500" />;
      default:
        return <Info className="w-5 h-5" />;
    }
  };

  return (
    <div className="card" style={{ padding: '1.5rem', margin: '1rem 0' }}>
      <div className="card-header" style={{ marginBottom: '1.5rem' }}>
        <h3 className="card-title" style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          Real Fund Data Importer
        </h3>
        <p className="card-subtitle" style={{ color: '#6b7280', fontSize: '0.875rem' }}>
          Import real fund data from CSV files to replace sample data and prepare for professional launch
        </p>
      </div>

      {/* File Selection */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h4 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem' }}>
          Select CSV Files
        </h4>
        
        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem' }}>
              Benchmarks.csv (32 benchmarks)
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setBenchmarkFile(e.target.files[0])}
              style={{ 
                width: '100%', 
                padding: '0.5rem', 
                border: '1px solid #d1d5db', 
                borderRadius: '0.375rem' 
              }}
            />
          </div>
          
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem' }}>
              RecListFunds.csv (107 recommended funds)
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setRecFundsFile(e.target.files[0])}
              style={{ 
                width: '100%', 
                padding: '0.5rem', 
                border: '1px solid #d1d5db', 
                borderRadius: '0.375rem' 
              }}
            />
          </div>
          
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem' }}>
              NonRecListFunds.csv (42 non-recommended funds)
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setNonRecFundsFile(e.target.files[0])}
              style={{ 
                width: '100%', 
                padding: '0.5rem', 
                border: '1px solid #d1d5db', 
                borderRadius: '0.375rem' 
              }}
            />
          </div>
        </div>
      </div>

      {/* Import Button */}
      <div style={{ marginBottom: '1.5rem' }}>
        <button
          onClick={handleImport}
          disabled={importing || !benchmarkFile || !recFundsFile || !nonRecFundsFile}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1.5rem',
            backgroundColor: importing ? '#9ca3af' : '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '0.375rem',
            fontSize: '0.875rem',
            fontWeight: '500',
            cursor: importing ? 'not-allowed' : 'pointer'
          }}
        >
          {getStepIcon(step)}
          {importing ? 'Importing...' : 'Import Real Data'}
        </button>
      </div>

      {/* Progress */}
      {progress && (
        <div style={{ 
          marginBottom: '1rem', 
          padding: '0.75rem', 
          backgroundColor: '#f3f4f6', 
          borderRadius: '0.375rem',
          fontSize: '0.875rem'
        }}>
          {progress}
        </div>
      )}

      {/* Results */}
      {results && (
        <div style={{ marginBottom: '1rem' }}>
          <h4 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.75rem' }}>
            Import Results
          </h4>
          <div style={{ 
            padding: '1rem', 
            backgroundColor: results.validation.success ? '#f0fdf4' : '#fffbeb', 
            border: `1px solid ${results.validation.success ? '#d1fae5' : '#fed7aa'}`,
            borderRadius: '0.375rem',
            fontSize: '0.875rem'
          }}>
            <div style={{ display: 'grid', gap: '0.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
              <div>
                <strong>Unique Benchmarks:</strong> {results.benchmarks}
              </div>
              <div>
                <strong>Benchmark Mappings:</strong> {results.benchmarkMappings}
              </div>
              <div>
                <strong>Recommended Funds:</strong> {results.recommendedFunds}
              </div>
              <div>
                <strong>Non-Recommended Funds:</strong> {results.nonRecommendedFunds}
              </div>
              <div>
                <strong>Total Funds:</strong> {results.totalFunds}
              </div>
            </div>
            <div style={{ marginTop: '0.75rem', fontWeight: '600' }}>
              Status: {results.validation.success ? 
                <span style={{ color: '#16a34a' }}>✅ SUCCESS</span> : 
                <span style={{ color: '#d97706' }}>⚠️ PARTIAL SUCCESS</span>
              }
            </div>
          </div>
        </div>
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <h4 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.75rem', color: '#dc2626' }}>
            Errors ({errors.length})
          </h4>
          <div style={{ 
            maxHeight: '200px', 
            overflowY: 'auto', 
            padding: '0.75rem', 
            backgroundColor: '#fef2f2', 
            border: '1px solid #fecaca',
            borderRadius: '0.375rem'
          }}>
            {errors.map((error, index) => (
              <div key={index} style={{ fontSize: '0.875rem', color: '#dc2626', marginBottom: '0.25rem' }}>
                • {error}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Instructions */}
      <div style={{ 
        padding: '1rem', 
        backgroundColor: '#f8fafc', 
        border: '1px solid #e2e8f0',
        borderRadius: '0.375rem',
        fontSize: '0.875rem'
      }}>
        <h4 style={{ fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem' }}>
          Instructions:
        </h4>
        <ol style={{ paddingLeft: '1.25rem', lineHeight: '1.5' }}>
          <li>Select the three CSV files from your src/data/real-data/ folder</li>
          <li>Click "Import Real Data" to clear sample data and import real data</li>
          <li>Review the results to ensure all 149 funds and 32 benchmarks were imported</li>
          <li>Navigate to Asset Class Table to verify real fund names are displayed</li>
          <li>Test Compare View with actual fund tickers</li>
        </ol>
        <div style={{ marginTop: '0.75rem', fontWeight: '500', color: '#059669' }}>
          Expected: ~20-25 unique benchmarks (with 32 total mappings) + 107 recommended funds + 42 non-recommended funds = 149 total funds
        </div>
      </div>
    </div>
  );
};

export default RealDataImporter;
