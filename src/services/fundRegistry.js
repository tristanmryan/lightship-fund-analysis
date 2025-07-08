// src/services/fundRegistry.js

import dataStore from './dataStore';
import assetClassGroups from '../data/assetClassGroups';

/**
 * Fund Registry Service
 * Manages fund classifications, versions, and history
 */
class FundRegistry {
  constructor() {
    this.cache = null;
    this.cacheTimestamp = null;
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Initialize the registry with default data if empty
   * @param {Array} defaultFunds - Default fund list
   * @param {Object} defaultBenchmarks - Default benchmark mappings
   */
  async initialize(defaultFunds = [], defaultBenchmarks = {}) {
    const existingFunds = await dataStore.getAllFunds();

    if (existingFunds.length === 0 && defaultFunds.length > 0) {
      console.log('Initializing fund registry with default data...');

      try {
        // Import default funds
        for (const fund of defaultFunds) {
          await dataStore.saveFund({
            symbol: fund.symbol,
            name: fund.name,
            assetClass: fund.assetClass,
            status: 'active',
            addedReason: 'Initial import from config',
            addedBy: 'system',
            tags: ['imported', 'default']
          });
        }

        // Import default benchmarks
        for (const [assetClass, benchmark] of Object.entries(defaultBenchmarks)) {
          await dataStore.saveBenchmark({
            assetClass,
            ticker: benchmark.ticker,
            name: benchmark.name
          });
        }

        // Create initial version
        await dataStore.createFundVersion(
          'Initial fund registry setup',
          'system'
        );

        console.log(`Imported ${defaultFunds.length} funds and ${Object.keys(defaultBenchmarks).length} benchmarks`);
      } catch (error) {
        console.error('Failed to initialize fund registry:', error);
        throw error;
      }
    }
  }

  /**
   * Get all active funds with caching
   * @returns {Promise<Array>} Active funds
   */
  async getActiveFunds() {
    // Check cache
    if (this.cache && this.cacheTimestamp && 
        (Date.now() - this.cacheTimestamp) < this.cacheTimeout) {
      return this.cache;
    }

    // Fetch from database
    const funds = await dataStore.getAllFunds(true); // activeOnly = true

    // Map asset groups
    const mapped = funds.map(f => ({
      ...f,
      assetGroup: assetClassGroups[f.assetClass] || 'Other'
    }));

    // Update cache
    this.cache = mapped;
    this.cacheTimestamp = Date.now();

    return mapped;
  }

  /**
   * Clear cache (call after any updates)
   */
  clearCache() {
    this.cache = null;
    this.cacheTimestamp = null;
  }

  /**
   * Check if a fund is in the registry
   * @param {string} symbol - Fund symbol
   * @returns {Promise<Object|null>} Fund data or null
   */
  async isRegisteredFund(symbol) {
    const funds = await this.getActiveFunds();
    return funds.find(f => f.symbol === symbol.toUpperCase()) || null;
  }

  /**
   * Get benchmark for an asset class
   * @param {string} assetClass - Asset class name
   * @returns {Promise<Object|null>} Benchmark data or null
   */
  async getBenchmarkForClass(assetClass) {
    const benchmarks = await dataStore.getAllBenchmarks();
    return benchmarks.find(b => b.assetClass === assetClass) || null;
  }

  /**
   * Get all benchmarks mapped by ticker
   * @returns {Promise<Object>} Map of ticker -> benchmark data
   */
  async getBenchmarksByTicker() {
    const benchmarks = await dataStore.getAllBenchmarks();
    const map = {};
    benchmarks.forEach(b => {
      map[b.ticker] = b;
    });
    return map;
  }

  /**
   * Get all benchmarks mapped by asset class
   * @returns {Promise<Object>} Map of assetClass -> { ticker, name }
   */
  async getBenchmarksByAssetClass() {
    const benchmarks = await dataStore.getAllBenchmarks();
    const map = {};
    benchmarks.forEach(b => {
      map[b.assetClass] = { ticker: b.ticker, name: b.name };
    });
    return map;
  }

  /**
   * Add a new fund with validation
   * @param {Object} fundData - Fund information
   * @param {string} reason - Reason for adding
   * @param {string} addedBy - User adding the fund
   * @returns {Promise<string>} Fund symbol
   */
  async addFund(fundData, reason, addedBy) {
    // Validate required fields
    if (!fundData.symbol || !fundData.name || !fundData.assetClass) {
      throw new Error('Symbol, name, and asset class are required');
    }

    // Check if fund already exists
    const existing = await dataStore.getFund(fundData.symbol);
    if (existing && existing.status === 'active') {
      throw new Error(`Fund ${fundData.symbol} already exists and is active`);
    }

    // If fund was previously removed, reactivate it
    if (existing && existing.status === 'removed') {
      await dataStore.addFundHistoryEntry({
        symbol: fundData.symbol,
        action: 'reactivated',
        previousState: existing,
        newState: { ...existing, status: 'active' },
        reason,
        changedBy: addedBy
      });

      existing.status = 'active';
      existing.reactivatedDate = new Date().toISOString();
      existing.reactivatedBy = addedBy;
      existing.reactivatedReason = reason;
      
      await dataStore.saveFund(existing);
      this.clearCache();
      return existing.symbol;
    }

    // Add new fund
    const newFund = {
      ...fundData,
      status: 'active',
      addedDate: new Date().toISOString(),
      addedBy,
      addedReason: reason
    };

    await dataStore.saveFund(newFund);
    
    // Add history entry
    await dataStore.addFundHistoryEntry({
      symbol: newFund.symbol,
      action: 'added',
      newState: newFund,
      reason,
      changedBy: addedBy
    });

    this.clearCache();
    return newFund.symbol;
  }

  /**
   * Remove a fund (soft delete)
   * @param {string} symbol - Fund symbol
   * @param {string} reason - Reason for removal
   * @param {string} removedBy - User removing the fund
   */
  async removeFund(symbol, reason, removedBy) {
    await dataStore.removeFund(symbol, reason, removedBy);
    this.clearCache();
  }

  /**
   * Update fund information
   * @param {string} symbol - Fund symbol
   * @param {Object} updates - Fields to update
   * @param {string} reason - Reason for update
   * @param {string} updatedBy - User making the update
   */
  async updateFund(symbol, updates, reason, updatedBy) {
    const fund = await dataStore.getFund(symbol);
    if (!fund) {
      throw new Error(`Fund ${symbol} not found`);
    }

    const previousState = { ...fund };
    const newState = { ...fund, ...updates, lastModified: new Date().toISOString() };

    // Track changes
    const changes = {};
    Object.keys(updates).forEach(key => {
      if (fund[key] !== updates[key]) {
        changes[key] = {
          from: fund[key],
          to: updates[key]
        };
      }
    });

    // Save updated fund
    await dataStore.saveFund(newState);

    // Add history entry
    await dataStore.addFundHistoryEntry({
      symbol,
      action: 'modified',
      previousState,
      newState,
      changes,
      reason,
      changedBy: updatedBy
    });

    this.clearCache();
  }

  /**
   * Update benchmark for an asset class
   * @param {string} assetClass - Asset class
   * @param {string} ticker - New benchmark ticker
   * @param {string} name - Benchmark name
   * @param {string} updatedBy - User making the update
   */
  async updateBenchmark(assetClass, ticker, name, updatedBy) {
    const existing = await this.getBenchmarkForClass(assetClass);
    
    await dataStore.saveBenchmark({
      assetClass,
      ticker,
      name,
      previousTicker: existing?.ticker,
      previousName: existing?.name,
      changedBy: updatedBy
    });
  }

  /**
   * Get fund history with details
   * @param {string} symbol - Fund symbol (optional)
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} History entries
   */
  async getFundHistory(symbol = null, filters = {}) {
    const history = await dataStore.getFundHistory(symbol, filters.limit || 100);
    
    // Apply additional filters
    let filtered = history;
    
    if (filters.action) {
      filtered = filtered.filter(h => h.action === filters.action);
    }
    
    if (filters.changedBy) {
      filtered = filtered.filter(h => h.changedBy === filters.changedBy);
    }
    
    if (filters.startDate) {
      filtered = filtered.filter(h => new Date(h.timestamp) >= new Date(filters.startDate));
    }
    
    if (filters.endDate) {
      filtered = filtered.filter(h => new Date(h.timestamp) <= new Date(filters.endDate));
    }

    return filtered;
  }

  /**
   * Search funds by various criteria
   * @param {Object} criteria - Search criteria
   * @returns {Promise<Array>} Matching funds
   */
  async searchFunds(criteria) {
    const allFunds = await dataStore.getAllFunds();
    
    return allFunds.filter(fund => {
      // Symbol search
      if (criteria.symbol && !fund.symbol.includes(criteria.symbol.toUpperCase())) {
        return false;
      }
      
      // Name search
      if (criteria.name && !fund.name.toLowerCase().includes(criteria.name.toLowerCase())) {
        return false;
      }
      
      // Asset class filter
      if (criteria.assetClass && fund.assetClass !== criteria.assetClass) {
        return false;
      }
      
      // Status filter
      if (criteria.status && fund.status !== criteria.status) {
        return false;
      }
      
      // Tag filter
      if (criteria.tags && criteria.tags.length > 0) {
        const fundTags = fund.tags || [];
        if (!criteria.tags.some(tag => fundTags.includes(tag))) {
          return false;
        }
      }
      
      // Date range filters
      if (criteria.addedAfter && new Date(fund.addedDate) < new Date(criteria.addedAfter)) {
        return false;
      }
      
      if (criteria.addedBefore && new Date(fund.addedDate) > new Date(criteria.addedBefore)) {
        return false;
      }
      
      return true;
    });
  }

  /**
   * Create a version snapshot
   * @param {string} message - Version message
   * @param {string} author - Version author
   * @returns {Promise<string>} Version ID
   */
  async createVersion(message, author) {
    return await dataStore.createFundVersion(message, author);
  }

  /**
   * Get version history
   * @param {number} limit - Maximum versions to return
   * @returns {Promise<Array>} Version list
   */
  async getVersionHistory(limit = 50) {
    return await dataStore.getFundVersions(limit);
  }

  /**
   * Restore from a specific version
   * @param {string} versionId - Version to restore
   * @param {string} restoredBy - User performing restore
   */
  async restoreVersion(versionId, restoredBy) {
    await dataStore.restoreFundVersion(versionId);
    
    // Add audit entry
    await dataStore.addFundHistoryEntry({
      symbol: '*',
      action: 'version_restored',
      reason: `Restored to version ${versionId}`,
      changedBy: restoredBy,
      metadata: { versionId }
    });
    
    this.clearCache();
  }

  /**
   * Get statistics about the fund registry
   * @returns {Promise<Object>} Statistics
   */
  async getStatistics() {
    const allFunds = await dataStore.getAllFunds();
    const benchmarks = await dataStore.getAllBenchmarks();
    const history = await dataStore.getFundHistory(null, 1000);
    
    // Group funds by status
    const byStatus = {
      active: 0,
      removed: 0,
      watchlist: 0
    };
    
    // Group by asset class
    const byAssetClass = {};
    
    allFunds.forEach(fund => {
      byStatus[fund.status] = (byStatus[fund.status] || 0) + 1;
      byAssetClass[fund.assetClass] = (byAssetClass[fund.assetClass] || 0) + 1;
    });
    
    // Recent activity
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentActivity = history.filter(h => new Date(h.timestamp) >= thirtyDaysAgo);
    
    return {
      totalFunds: allFunds.length,
      activeFunds: byStatus.active,
      removedFunds: byStatus.removed,
      watchlistFunds: byStatus.watchlist || 0,
      assetClasses: Object.keys(byAssetClass).length,
      benchmarks: benchmarks.length,
      byAssetClass,
      recentChanges: recentActivity.length,
      recentActivity: recentActivity.slice(0, 10)
    };
  }

  /**
   * Export fund list for external use
   * @param {boolean} includeRemoved - Include removed funds
   * @returns {Promise<Object>} Export data
   */
  async exportFundList(includeRemoved = false) {
    const funds = await dataStore.getAllFunds();
    const benchmarks = await dataStore.getAllBenchmarks();
    
    const exportData = {
      exportDate: new Date().toISOString(),
      version: await dataStore.createFundVersion('Export snapshot', 'system'),
      funds: includeRemoved ? funds : funds.filter(f => f.status === 'active'),
      benchmarks,
      statistics: await this.getStatistics()
    };
    
    return exportData;
  }

  /**
   * Import fund list from export
   * @param {Object} importData - Data to import
   * @param {string} importedBy - User performing import
   * @returns {Promise<Object>} Import results
   */
  async importFundList(importData, importedBy) {
    const results = {
      fundsAdded: 0,
      fundsUpdated: 0,
      fundsSkipped: 0,
      benchmarksUpdated: 0,
      errors: []
    };
    
    // Import funds
    for (const fund of importData.funds) {
      try {
        const existing = await dataStore.getFund(fund.symbol);
        
        if (!existing) {
          await this.addFund(fund, `Imported from file`, importedBy);
          results.fundsAdded++;
        } else if (existing.lastModified < fund.lastModified) {
          await this.updateFund(fund.symbol, fund, `Updated from import`, importedBy);
          results.fundsUpdated++;
        } else {
          results.fundsSkipped++;
        }
      } catch (error) {
        results.errors.push({
          symbol: fund.symbol,
          error: error.message
        });
      }
    }
    
    // Import benchmarks
    for (const benchmark of importData.benchmarks) {
      try {
        await this.updateBenchmark(
          benchmark.assetClass,
          benchmark.ticker,
          benchmark.name,
          importedBy
        );
        results.benchmarksUpdated++;
      } catch (error) {
        results.errors.push({
          assetClass: benchmark.assetClass,
          error: error.message
        });
      }
    }
    
    // Create version after import
    await this.createVersion(
      `Import completed: ${results.fundsAdded} added, ${results.fundsUpdated} updated`,
      importedBy
    );
    
    this.clearCache();
    return results;
  }
}

// Create singleton instance
const fundRegistry = new FundRegistry();

export default fundRegistry;