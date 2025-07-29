// src/data/storage.js
import { saveConfig, getConfig } from '../services/dataStore.js';

// Keys for configuration storage
export const CONFIG_KEYS = {
  RECOMMENDED_FUNDS: 'recommendedFunds',
  ASSET_CLASS_BENCHMARKS: 'assetClassBenchmarks',
  SCORING_WEIGHTS: 'scoringWeights'
};

/**
 * Migrate data from localStorage to IndexedDB if needed
 */
async function migrateFromLocalStorage() {
  try {
    // Check if data exists in localStorage
    const localFunds = localStorage.getItem(CONFIG_KEYS.RECOMMENDED_FUNDS);
    const localBenchmarks = localStorage.getItem(CONFIG_KEYS.ASSET_CLASS_BENCHMARKS);
    
    if (localFunds || localBenchmarks) {
      console.log('Migrating data from localStorage to IndexedDB...');
      
      // Save to IndexedDB
      if (localFunds) {
        await saveConfig(CONFIG_KEYS.RECOMMENDED_FUNDS, JSON.parse(localFunds));
        localStorage.removeItem(CONFIG_KEYS.RECOMMENDED_FUNDS);
      }
      
      if (localBenchmarks) {
        await saveConfig(CONFIG_KEYS.ASSET_CLASS_BENCHMARKS, JSON.parse(localBenchmarks));
        localStorage.removeItem(CONFIG_KEYS.ASSET_CLASS_BENCHMARKS);
      }
      
      console.log('Migration completed successfully');
    }
  } catch (error) {
    console.error('Error migrating from localStorage:', error);
    // Don't throw - allow app to continue with defaults
  }
}

/**
 * Get stored configuration from IndexedDB
 * Falls back to localStorage for backwards compatibility
 * @returns {Object} Saved funds and benchmarks
 */
export const getStoredConfig = async () => {
  try {
    // First, attempt migration if needed
    await migrateFromLocalStorage();
    
    // Get from IndexedDB
    const [savedFunds, savedBenchmarks] = await Promise.all([
      getConfig(CONFIG_KEYS.RECOMMENDED_FUNDS),
      getConfig(CONFIG_KEYS.ASSET_CLASS_BENCHMARKS)
    ]);
    
    return {
      savedFunds,
      savedBenchmarks
    };
  } catch (error) {
    console.error('Error getting stored config:', error);
    
    // Fallback to localStorage if IndexedDB fails
    try {
      const funds = localStorage.getItem(CONFIG_KEYS.RECOMMENDED_FUNDS);
      const benchmarks = localStorage.getItem(CONFIG_KEYS.ASSET_CLASS_BENCHMARKS);
      return {
        savedFunds: funds ? JSON.parse(funds) : null,
        savedBenchmarks: benchmarks ? JSON.parse(benchmarks) : null
      };
    } catch (localError) {
      console.error('Error with localStorage fallback:', localError);
      return { savedFunds: null, savedBenchmarks: null };
    }
  }
};

/**
 * Save configuration to IndexedDB
 * @param {Array} recommendedFunds - List of recommended funds
 * @param {Object} assetClassBenchmarks - Asset class to benchmark mappings
 */
export const saveStoredConfig = async (recommendedFunds, assetClassBenchmarks) => {
  try {
    await Promise.all([
      saveConfig(CONFIG_KEYS.RECOMMENDED_FUNDS, recommendedFunds),
      saveConfig(CONFIG_KEYS.ASSET_CLASS_BENCHMARKS, assetClassBenchmarks)
    ]);
  } catch (error) {
    console.error('Error saving to IndexedDB:', error);
    
    // Fallback to localStorage if IndexedDB fails
    try {
      localStorage.setItem(CONFIG_KEYS.RECOMMENDED_FUNDS, JSON.stringify(recommendedFunds));
      localStorage.setItem(CONFIG_KEYS.ASSET_CLASS_BENCHMARKS, JSON.stringify(assetClassBenchmarks));
      console.warn('Saved to localStorage as fallback');
    } catch (localError) {
      console.error('Error with localStorage fallback:', localError);
      throw new Error('Failed to save configuration');
    }
  }
};