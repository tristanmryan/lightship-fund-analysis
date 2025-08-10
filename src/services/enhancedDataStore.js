// src/services/enhancedDataStore.js
// Combines historical data with user data

import { 
    getAllHistoricalSnapshots, 
    getHistoricalSnapshot 
} from '../data/historicalSnapshots.js';
  import {
  getAllSnapshots as getUserSnapshots,
  getSnapshot as getUserSnapshot,
  saveSnapshot
} from './dataStore.js';
  
  /**
   * Get all snapshots - combines historical + user data
   * Historical data is available to everyone
   * User data is personal to each browser
   */
  export async function getAllCombinedSnapshots() {
    try {
      // Get user's personal snapshots from IndexedDB
      const userSnapshots = await getUserSnapshots();
      
      // Get shared historical snapshots (built into app)
      const historicalSnapshots = getAllHistoricalSnapshots();
      
      console.log(`📊 Found ${historicalSnapshots.length} historical snapshots`);
      console.log(`👤 Found ${userSnapshots.length} user snapshots`);
      
      // Combine both arrays
      const allSnapshots = [...historicalSnapshots, ...userSnapshots];
      
      // Remove duplicates (user data takes precedence over historical)
      const uniqueSnapshots = [];
      const seenIds = new Set();
      
      // Sort by date (newest first) so user data comes first for same month
      allSnapshots.sort((a, b) => new Date(b.date) - new Date(a.date));
      
      for (const snapshot of allSnapshots) {
        if (!seenIds.has(snapshot.id)) {
          uniqueSnapshots.push(snapshot);
          seenIds.add(snapshot.id);
        }
      }
      
      // Sort final result by date (newest first)
      uniqueSnapshots.sort((a, b) => new Date(b.date) - new Date(a.date));
      
      console.log(`🎯 Returning ${uniqueSnapshots.length} total snapshots`);
      return uniqueSnapshots;
      
    } catch (error) {
      console.error('Error getting combined snapshots:', error);
      // Fallback to just historical data if user data fails
      const historicalSnapshots = getAllHistoricalSnapshots();
      console.log(`⚠️ Fallback: returning ${historicalSnapshots.length} historical snapshots only`);
      return historicalSnapshots;
    }
  }
  
  /**
   * Get a specific snapshot by ID
   * Checks user data first, then historical data
   */
  export async function getCombinedSnapshot(snapshotId) {
    try {
      // First, try to get from user's personal data
      const userSnapshot = await getUserSnapshot(snapshotId);
      if (userSnapshot) {
        console.log(`📱 Found ${snapshotId} in user data`);
        return userSnapshot;
      }
      
      // If not found, check historical data
      const historicalSnapshot = getHistoricalSnapshot(snapshotId);
      if (historicalSnapshot) {
        console.log(`📊 Found ${snapshotId} in historical data`);
        return historicalSnapshot;
      }
      
      console.log(`❌ Snapshot ${snapshotId} not found`);
      return null;
      
    } catch (error) {
      console.error('Error getting combined snapshot:', error);
      // Fallback to historical data only
      return getHistoricalSnapshot(snapshotId) || null;
    }
  }
  
  /**
   * Get snapshots within a date range
   */
  export async function getCombinedSnapshotsByDateRange(startDate, endDate) {
    const allSnapshots = await getAllCombinedSnapshots();
    return allSnapshots.filter(snapshot => {
      const snapshotDate = new Date(snapshot.date);
      return snapshotDate >= new Date(startDate) && snapshotDate <= new Date(endDate);
    });
  }
  
  /**
   * Check if historical data is available
   */
  export function hasHistoricalData() {
    const historicalSnapshots = getAllHistoricalSnapshots();
    return historicalSnapshots.length > 0;
  }
  
  /**
   * Get data coverage summary
   */
  export async function getDataSummary() {
    const userSnapshots = await getUserSnapshots();
    const historicalSnapshots = getAllHistoricalSnapshots();
    const allSnapshots = await getAllCombinedSnapshots();
    
    const dates = allSnapshots.map(s => new Date(s.date));
    dates.sort((a, b) => a - b);
    
    return {
      historical: {
        count: historicalSnapshots.length,
        source: "Built-in historical data",
        dateRange: historicalSnapshots.length > 0 ? {
          earliest: Math.min(...historicalSnapshots.map(s => new Date(s.date))),
          latest: Math.max(...historicalSnapshots.map(s => new Date(s.date)))
        } : null
      },
      user: {
        count: userSnapshots.length,
        source: "User uploaded data"
      },
      combined: {
        total: allSnapshots.length,
        dateRange: dates.length > 0 ? {
          earliest: dates[0],
          latest: dates[dates.length - 1]
        } : null
      }
    };
  }
  
  /**
   * Save a new user snapshot (existing functionality)
   */
  export async function saveUserSnapshot(snapshotData) {
    return await saveSnapshot(snapshotData);
  }
  
  /**
   * Get the latest available snapshot
   */
  export async function getLatestSnapshot() {
    const allSnapshots = await getAllCombinedSnapshots();
    return allSnapshots.length > 0 ? allSnapshots[0] : null;
  }
  
  /**
   * Check if data exists for a specific month
   */
  export async function hasDataForMonth(year, month) {
    const snapshotId = `snapshot_${year}_${month.toString().padStart(2, '0')}`;
    const snapshot = await getCombinedSnapshot(snapshotId);
    return snapshot !== null;
  }

  /**
   * Compare two snapshots using combined data
   * @param {string} snapshotId1 - First snapshot ID
   * @param {string} snapshotId2 - Second snapshot ID
   * @returns {Promise<Object>} Comparison results
   */
  export async function compareCombinedSnapshots(snapshotId1, snapshotId2) {
    try {
      const [snapshot1, snapshot2] = await Promise.all([
        getCombinedSnapshot(snapshotId1),
        getCombinedSnapshot(snapshotId2)
      ]);

      if (!snapshot1 || !snapshot2) {
        throw new Error('One or both snapshots not found');
      }

      const comparison = {
        snapshot1: { id: snapshotId1, date: snapshot1.date },
        snapshot2: { id: snapshotId2, date: snapshot2.date },
        changes: []
      };

      const funds1Map = new Map(snapshot1.funds.map(f => [f.Symbol, f]));
      const funds2Map = new Map(snapshot2.funds.map(f => [f.Symbol, f]));

      funds2Map.forEach((fund2, symbol) => {
        const fund1 = funds1Map.get(symbol);

        if (fund1 && fund1.scores && fund2.scores) {
          const scoreDiff = fund2.scores.final - fund1.scores.final;

          if (Math.abs(scoreDiff) > 0) {
            comparison.changes.push({
              symbol,
              fundName: fund2['Fund Name'],
          assetClass: fund2.asset_class_name || fund2.asset_class || fund2['Asset Class'],
              oldScore: fund1.scores.final,
              newScore: fund2.scores.final,
              change: scoreDiff,
              changePercent: ((scoreDiff / fund1.scores.final) * 100).toFixed(1)
            });
          }
        } else if (!fund1) {
          comparison.changes.push({
            symbol,
            fundName: fund2['Fund Name'],
          assetClass: fund2.asset_class_name || fund2.asset_class || fund2['Asset Class'],
            type: 'new',
            newScore: fund2.scores?.final
          });
        }
      });

      funds1Map.forEach((fund1, symbol) => {
        if (!funds2Map.has(symbol)) {
          comparison.changes.push({
            symbol,
            fundName: fund1['Fund Name'],
          assetClass: fund1.asset_class_name || fund1.asset_class || fund1['Asset Class'],
            type: 'removed',
            oldScore: fund1.scores?.final
          });
        }
      });

      comparison.changes.sort((a, b) => {
        const changeA = Math.abs(a.change || 0);
        const changeB = Math.abs(b.change || 0);
        return changeB - changeA;
      });

      return comparison;
    } catch (error) {
      console.error('Error comparing combined snapshots:', error);
      throw error;
    }
  }