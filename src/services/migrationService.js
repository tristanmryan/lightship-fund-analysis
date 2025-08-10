// src/services/migrationService.js
import { supabase, TABLES, dbUtils } from './supabase';
import fundService from './fundService';

class MigrationService {
  // Check if migration is needed
  async checkMigrationStatus() {
    try {
      // Check if we have any funds in Supabase
      const { data: funds, error } = await supabase
        .from(TABLES.FUNDS)
        .select('count')
        .limit(1);

      if (error) throw error;

      const hasSupabaseData = funds && funds.length > 0;
      
      // Check if we have IndexedDB data
      const hasIndexedDBData = process.env.NODE_ENV === 'test' ? false : await this.checkIndexedDBData();

      return {
        hasSupabaseData,
        hasIndexedDBData,
        needsMigration: hasIndexedDBData && !hasSupabaseData
      };
    } catch (error) {
      console.error('Failed to check migration status:', error);
      return {
        hasSupabaseData: false,
        hasIndexedDBData: false,
        needsMigration: false
      };
    }
  }

  // Check if IndexedDB has data
  async checkIndexedDBData() {
    try {
      // Try to access IndexedDB data
      const { getAllSnapshots } = await import('./dataStore');
      const snapshots = await getAllSnapshots();
      return snapshots && snapshots.length > 0;
    } catch (error) {
      console.log('No IndexedDB data found or error accessing it:', error);
      return false;
    }
  }

  // Migrate data from IndexedDB to Supabase
  async migrateFromIndexedDB() {
    try {
      console.log('Starting migration from IndexedDB to Supabase...');

      // Import IndexedDB services
      const { getAllSnapshots, getConfig } = await import('./dataStore');

      // Get all snapshots from IndexedDB
      const snapshots = await getAllSnapshots();
      console.log(`Found ${snapshots.length} snapshots to migrate`);

      // Get configuration data
      const recommendedFunds = await getConfig('recommendedFunds') || [];
      const assetClassBenchmarks = await getConfig('assetClassBenchmarks') || {};

      // Migrate funds from snapshots
      const migratedFunds = new Set();
      let totalFunds = 0;

      for (const snapshot of snapshots) {
        if (snapshot.data && Array.isArray(snapshot.data)) {
          for (const fund of snapshot.data) {
            if (fund.Symbol && !migratedFunds.has(fund.Symbol)) {
              try {
                // Prepare fund data
                const fundData = {
                  ticker: dbUtils.cleanSymbol(fund.Symbol),
                  name: fund['Fund Name'] || fund['Product Name'] || '',
  asset_class: fund.asset_class || fund['Asset Class'] || '',
                  is_recommended: recommendedFunds.some(rf => 
                    dbUtils.cleanSymbol(rf.Symbol) === dbUtils.cleanSymbol(fund.Symbol)
                  ),
                  added_date: snapshot.date || new Date(),
                  notes: ''
                };

                // Save fund to Supabase
                await fundService.saveFund(fundData);

                // Prepare performance data
                const performanceData = {
                  ticker: fundData.ticker,
                  date: snapshot.date || new Date(),
                  ytd_return: dbUtils.parseNumeric(fund.YTD || fund['Total Return - YTD (%)']),
                  one_year_return: dbUtils.parseNumeric(fund['1 Year'] || fund['Total Return - 1 Year (%)']),
                  three_year_return: dbUtils.parseNumeric(fund['3 Year'] || fund['Annualized Total Return - 3 Year (%)']),
                  five_year_return: dbUtils.parseNumeric(fund['5 Year'] || fund['Annualized Total Return - 5 Year (%)']),
                  ten_year_return: dbUtils.parseNumeric(fund['10 Year'] || fund['Annualized Total Return - 10 Year (%)']),
                  sharpe_ratio: dbUtils.parseNumeric(fund['Sharpe Ratio'] || fund['Sharpe Ratio - 3 Year']),
                  standard_deviation: dbUtils.parseNumeric(fund['Standard Deviation'] || fund['Standard Deviation - 3 Year']),
                  expense_ratio: dbUtils.parseNumeric(fund['Net Expense Ratio'] || fund['Net Exp Ratio (%)']),
                  alpha: dbUtils.parseNumeric(fund.Alpha || fund['Alpha (Asset Class) - 5 Year']),
                  beta: dbUtils.parseNumeric(fund.Beta),
                  manager_tenure: dbUtils.parseNumeric(fund['Manager Tenure'] || fund['Longest Manager Tenure (Years)'])
                };

                // Save performance data to Supabase
                await fundService.saveFundPerformance(performanceData);

                migratedFunds.add(fund.Symbol);
                totalFunds++;

                console.log(`Migrated fund: ${fund.Symbol}`);
              } catch (error) {
                console.error(`Failed to migrate fund ${fund.Symbol}:`, error);
              }
            }
          }
        }
      }

      // Migrate benchmarks
      for (const [assetClass, benchmark] of Object.entries(assetClassBenchmarks)) {
        try {
          const { error } = await supabase
            .from(TABLES.BENCHMARKS)
            .upsert({
              asset_class: assetClass,
              ticker: benchmark.ticker || '',
              name: benchmark.name || '',
              is_active: true
            }, { onConflict: 'asset_class' });

          if (error) throw error;
          console.log(`Migrated benchmark: ${assetClass}`);
        } catch (error) {
          console.error(`Failed to migrate benchmark ${assetClass}:`, error);
        }
      }

      // Save migration metadata
      const migrationMetadata = {
        migrated_at: new Date().toISOString(),
        total_snapshots: snapshots.length,
        total_funds: totalFunds,
        source: 'indexeddb',
        version: '1.0'
      };

      const { error: metadataError } = await supabase
        .from(TABLES.SNAPSHOTS)
        .insert({
          name: 'Migration from IndexedDB',
          date: new Date(),
          data: migrationMetadata,
          metadata: { type: 'migration', source: 'indexeddb' }
        });

      if (metadataError) {
        console.error('Failed to save migration metadata:', metadataError);
      }

      console.log(`Migration completed successfully! Migrated ${totalFunds} funds.`);
      return {
        success: true,
        totalFunds,
        totalSnapshots: snapshots.length
      };

    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  }

  // Export current Supabase data
  async exportSupabaseData() {
    try {
      const { data: funds, error: fundsError } = await supabase
        .from(TABLES.FUNDS)
        .select('*');

      if (fundsError) throw fundsError;

      const { data: performance, error: perfError } = await supabase
        .from(TABLES.FUND_PERFORMANCE)
        .select('*');

      if (perfError) throw perfError;

      const { data: benchmarks, error: benchError } = await supabase
        .from(TABLES.BENCHMARKS)
        .select('*');

      if (benchError) throw benchError;

      const exportData = {
        funds: funds || [],
        performance: performance || [],
        benchmarks: benchmarks || [],
        exported_at: new Date().toISOString(),
        version: '1.0'
      };

      return exportData;
    } catch (error) {
      console.error('Failed to export Supabase data:', error);
      throw error;
    }
  }

  // Import data to Supabase
  async importSupabaseData(importData) {
    try {
      console.log('Starting data import to Supabase...');

      let totalImported = 0;

      // Import funds
      if (importData.funds && Array.isArray(importData.funds)) {
        for (const fund of importData.funds) {
          try {
            await fundService.saveFund(fund);
            totalImported++;
          } catch (error) {
            console.error(`Failed to import fund ${fund.ticker}:`, error);
          }
        }
      }

      // Import performance data
      if (importData.performance && Array.isArray(importData.performance)) {
        for (const perf of importData.performance) {
          try {
            await fundService.saveFundPerformance(perf);
          } catch (error) {
            console.error(`Failed to import performance data for ${perf.fund_ticker}:`, error);
          }
        }
      }

      // Import benchmarks
      if (importData.benchmarks && Array.isArray(importData.benchmarks)) {
        for (const benchmark of importData.benchmarks) {
          try {
            const { error } = await supabase
              .from(TABLES.BENCHMARKS)
              .upsert(benchmark, { onConflict: 'asset_class' });

            if (error) throw error;
          } catch (error) {
            console.error(`Failed to import benchmark ${benchmark.asset_class}:`, error);
          }
        }
      }

      console.log(`Import completed successfully! Imported ${totalImported} funds.`);
      return {
        success: true,
        totalImported
      };

    } catch (error) {
      console.error('Import failed:', error);
      throw error;
    }
  }
}

// Create singleton instance
const migrationService = new MigrationService();

export default migrationService; 