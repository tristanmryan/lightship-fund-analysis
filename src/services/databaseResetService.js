// src/services/databaseResetService.js

import { supabase, TABLES, isSupabaseStubbed } from './supabase.js';
import { clearAllData as clearIndexedDB } from './dataStore.js';
import fundRegistry from './fundRegistry.js';
import { assetClassBenchmarks } from '../data/config.js';

/**
 * Database Reset Service
 * Provides clean professional reset functionality while preserving essential structures
 */
class DatabaseResetService {
  
  /**
   * Perform a complete professional reset
   * Clears sample data while preserving essential configurations
   */
  async performProfessionalReset() {
    const resetLog = {
      started: new Date().toISOString(),
      indexedDbCleared: false,
      supabaseCleared: false,
      benchmarksPreserved: false,
      assetClassesPreserved: false,
      errors: []
    };

    try {
      console.log('🔄 Starting professional database reset...');

      // Step 1: Clear IndexedDB (local storage)
      try {
        await this.clearIndexedDBData();
        resetLog.indexedDbCleared = true;
        console.log('✅ IndexedDB cleared successfully');
      } catch (error) {
        resetLog.errors.push(`IndexedDB: ${error.message}`);
        console.error('❌ IndexedDB clear failed:', error);
      }

      // Step 2: Clear Supabase data (if connected)
      try {
        await this.clearSupabaseData();
        resetLog.supabaseCleared = true;
        console.log('✅ Supabase data cleared successfully');
      } catch (error) {
        resetLog.errors.push(`Supabase: ${error.message}`);
        console.error('❌ Supabase clear failed:', error);
      }

      // Step 3: Re-initialize essential structures
      try {
        await this.preserveEssentialStructures();
        resetLog.benchmarksPreserved = true;
        resetLog.assetClassesPreserved = true;
        console.log('✅ Essential structures preserved');
      } catch (error) {
        resetLog.errors.push(`Structure preservation: ${error.message}`);
        console.error('❌ Structure preservation failed:', error);
      }

      resetLog.completed = new Date().toISOString();
      resetLog.success = resetLog.errors.length === 0;

      console.log('🎉 Professional reset completed:', resetLog);
      return resetLog;

    } catch (error) {
      resetLog.errors.push(`General: ${error.message}`);
      resetLog.success = false;
      console.error('❌ Professional reset failed:', error);
      throw error;
    }
  }

  /**
   * Clear IndexedDB data completely
   */
  async clearIndexedDBData() {
    await clearIndexedDB();
  }

  /**
   * Clear Supabase data while preserving schema
   */
  async clearSupabaseData() {
    if (isSupabaseStubbed) {
      console.log('⚠️ Supabase is stubbed, skipping Supabase data clearing');
      return;
    }

    // Tables to clear - preserve schema but clear data
    const tablesToClear = [
      TABLES.FUND_PERFORMANCE,
      TABLES.MONTHLY_SNAPSHOTS, 
      TABLES.FUND_RESEARCH_NOTES,
      'activity_logs' // Clear activity logs for clean start
    ];

    const clearPromises = tablesToClear.map(async (table) => {
      try {
        const { error } = await supabase
          .from(table)
          .delete()
          .neq('id', 'impossible-id'); // Delete all records

        if (error && !error.message?.includes('does not exist')) {
          console.warn(`⚠️ Warning clearing table ${table}:`, error.message);
        } else {
          console.log(`✅ Cleared table: ${table}`);
        }
      } catch (error) {
        console.warn(`⚠️ Warning clearing table ${table}:`, error.message);
      }
    });

    await Promise.all(clearPromises);
  }

  /**
   * Preserve essential structures after reset
   */
  async preserveEssentialStructures() {
    // Re-initialize benchmark mappings
    await fundRegistry.initialize([], assetClassBenchmarks);
    
    // Note: Asset class groups are typically in configuration and don't need restoration
    // Scoring weights are preserved in the scoring service configuration
  }

  /**
   * Get current database status
   */
  async getDatabaseStatus() {
    const status = {
      indexedDb: await this.getIndexedDBStatus(),
      supabase: await this.getSupabaseStatus(),
      ready: false
    };

    status.ready = status.indexedDb.accessible && (status.supabase.accessible || isSupabaseStubbed);
    return status;
  }

  /**
   * Get IndexedDB status
   */
  async getIndexedDBStatus() {
    try {
      // Test IndexedDB access
      const testDb = indexedDB.open('test', 1);
      await new Promise((resolve, reject) => {
        testDb.onsuccess = () => {
          testDb.result.close();
          resolve();
        };
        testDb.onerror = () => reject(testDb.error);
      });

      return {
        accessible: true,
        error: null
      };
    } catch (error) {
      return {
        accessible: false,
        error: error.message
      };
    }
  }

  /**
   * Get Supabase status
   */
  async getSupabaseStatus() {
    if (isSupabaseStubbed) {
      return {
        accessible: false,
        stubbed: true,
        error: 'Supabase credentials not configured'
      };
    }

    try {
      // Test Supabase connection with a simple query
      const { error } = await supabase
        .from(TABLES.FUND_PERFORMANCE)
        .select('count', { count: 'exact', head: true })
        .limit(1);

      return {
        accessible: !error,
        stubbed: false,
        error: error?.message || null
      };
    } catch (error) {
      return {
        accessible: false,
        stubbed: false,
        error: error.message
      };
    }
  }

  /**
   * Validate reset was successful
   */
  async validateReset() {
    const validation = {
      indexedDbEmpty: false,
      supabaseEmpty: false,
      benchmarksPresent: false,
      errors: []
    };

    try {
      // Check IndexedDB is empty of user data
      // This would require specific checks based on what should be empty

      // Check Supabase tables are empty
      if (!isSupabaseStubbed) {
        const { data: performanceData } = await supabase
          .from(TABLES.FUND_PERFORMANCE)
          .select('id')
          .limit(1);
        
        validation.supabaseEmpty = !performanceData || performanceData.length === 0;
      } else {
        validation.supabaseEmpty = true;
      }

      // Check benchmarks are preserved
      const benchmarks = await fundRegistry.getBenchmarksByAssetClass();
      validation.benchmarksPresent = Object.keys(benchmarks).length > 0;

    } catch (error) {
      validation.errors.push(error.message);
    }

    validation.success = validation.indexedDbEmpty && validation.supabaseEmpty && validation.benchmarksPresent && validation.errors.length === 0;
    return validation;
  }
}

// Export singleton instance
const databaseResetService = new DatabaseResetService();
export default databaseResetService;