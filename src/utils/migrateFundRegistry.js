// src/utils/migrateFundRegistry.js

import fundRegistry from '../services/fundRegistry';
import { recommendedFunds, assetClassBenchmarks } from '../data/config';

/**
 * Migration utility to import existing config into new fund registry
 */
export async function migrateFundRegistry() {
  console.log('Starting fund registry migration...');
  
  try {
    // Check if migration is needed
    const stats = await fundRegistry.getStatistics();
    if (stats.totalFunds > 0) {
      console.log('Fund registry already contains data, skipping migration');
      return {
        status: 'skipped',
        message: 'Registry already initialized',
        stats
      };
    }

    // Initialize registry with default data
    try {
      await fundRegistry.initialize(recommendedFunds, assetClassBenchmarks);
    } catch (dbError) {
      console.error('Error initializing registry:', dbError);
      return {
        status: 'error',
        message: dbError.message,
        error: dbError
      };
    }
    
    // Get updated statistics
    const newStats = await fundRegistry.getStatistics();
    
    console.log('Migration completed successfully');
    return {
      status: 'success',
      message: 'Successfully migrated fund data',
      stats: newStats,
      migrated: {
        funds: recommendedFunds.length,
        benchmarks: Object.keys(assetClassBenchmarks).length
      }
    };
  } catch (error) {
    console.error('Migration failed:', error);
    return {
      status: 'error',
      message: error.message,
      error
    };
  }
}

/**
 * Check if migration is needed
 */
export async function isMigrationNeeded() {
  try {
    const stats = await fundRegistry.getStatistics();
    return stats.totalFunds === 0;
  } catch (error) {
    // If error, assume migration is needed
    return true;
  }
}

/**
 * Export current fund registry for backup
 */
export async function exportCurrentRegistry() {
  try {
    const exportData = await fundRegistry.exportFundList(true);
    
    // Convert to downloadable format
    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Create download link
    const a = document.createElement('a');
    a.href = url;
    a.download = `fund_registry_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    return {
      status: 'success',
      message: 'Registry exported successfully'
    };
  } catch (error) {
    console.error('Export failed:', error);
    return {
      status: 'error',
      message: error.message
    };
  }
}

/**
 * Clear all fund registry data (use with caution!)
 */
export async function clearFundRegistry() {
  if (!window.confirm('Are you sure you want to clear all fund registry data? This cannot be undone!')) {
    return {
      status: 'cancelled',
      message: 'Operation cancelled by user'
    };
  }
  
  try {
    // Create backup first
    await exportCurrentRegistry();
    
    // Clear data
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('LightshipFundAnalysis');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    const transaction = db.transaction(['fundRegistry', 'fundHistory', 'fundVersions', 'benchmarkHistory'], 'readwrite');
    
    await Promise.all([
      transaction.objectStore('fundRegistry').clear(),
      transaction.objectStore('fundHistory').clear(),
      transaction.objectStore('fundVersions').clear(),
      transaction.objectStore('benchmarkHistory').clear()
    ]);
    
    // Clear cache
    fundRegistry.clearCache();
    
    return {
      status: 'success',
      message: 'Fund registry cleared successfully'
    };
  } catch (error) {
    console.error('Clear failed:', error);
    return {
      status: 'error',
      message: error.message
    };
  }
}