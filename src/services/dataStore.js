// src/services/dataStore.js

/**
 * IndexedDB Data Store for Lightship Fund Analysis
 * Handles persistent storage of snapshots, configuration, and preferences
 */

const DB_NAME = 'LightshipFundAnalysis';
const DB_VERSION = 1;

// Object store names
const STORES = {
  SNAPSHOTS: 'snapshots',
  CONFIG: 'config',
  PREFERENCES: 'preferences',
  AUDIT_LOG: 'auditLog'
};

// Initialize database connection
let db = null;

/**
 * Open IndexedDB connection and create stores if needed
 * @returns {Promise<IDBDatabase>} Database connection
 */
async function openDB() {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Failed to open database:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      console.log('Database opened successfully');
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      
      // Create snapshots store
      if (!database.objectStoreNames.contains(STORES.SNAPSHOTS)) {
        const snapshotStore = database.createObjectStore(STORES.SNAPSHOTS, { 
          keyPath: 'id' 
        });
        snapshotStore.createIndex('date', 'date', { unique: false });
        snapshotStore.createIndex('uploadDate', 'metadata.uploadDate', { unique: false });
      }

      // Create config store
      if (!database.objectStoreNames.contains(STORES.CONFIG)) {
        database.createObjectStore(STORES.CONFIG, { keyPath: 'key' });
      }

      // Create preferences store
      if (!database.objectStoreNames.contains(STORES.PREFERENCES)) {
        database.createObjectStore(STORES.PREFERENCES, { keyPath: 'key' });
      }

      // Create audit log store
      if (!database.objectStoreNames.contains(STORES.AUDIT_LOG)) {
        const auditStore = database.createObjectStore(STORES.AUDIT_LOG, { 
          keyPath: 'id',
          autoIncrement: true 
        });
        auditStore.createIndex('timestamp', 'timestamp', { unique: false });
        auditStore.createIndex('action', 'action', { unique: false });
      }
    };
  });
}

/**
 * Generate snapshot ID from date
 * @param {Date} date - Snapshot date
 * @returns {string} Snapshot ID
 */
function generateSnapshotId(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `snapshot_${year}_${month}`;
}

/**
 * Save a monthly snapshot
 * @param {Object} snapshotData - Snapshot data including funds and metadata
 * @returns {Promise<string>} Snapshot ID
 */
export async function saveSnapshot(snapshotData) {
  const database = await openDB();
  
  // Generate ID based on date
  const snapshotDate = snapshotData.date || new Date().toISOString();
  const id = generateSnapshotId(snapshotDate);
  
  const snapshot = {
    id,
    date: snapshotDate,
    funds: snapshotData.funds || [],
    metadata: {
      uploadDate: new Date().toISOString(),
      uploadedBy: snapshotData.uploadedBy || 'user',
      totalFunds: snapshotData.funds?.length || 0,
      recommendedFunds: snapshotData.funds?.filter(f => f.isRecommended).length || 0,
      fileName: snapshotData.fileName,
      ...snapshotData.metadata
    },
    classSummaries: snapshotData.classSummaries || {},
    reviewCandidates: snapshotData.reviewCandidates || []
  };

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.SNAPSHOTS], 'readwrite');
    const store = transaction.objectStore(STORES.SNAPSHOTS);
    
    // Use put instead of add to allow updates
    const request = store.put(snapshot);
    
    request.onsuccess = () => {
      console.log('Snapshot saved:', id);
      
      // Log the action
      logAction('snapshot_saved', { snapshotId: id, fundsCount: snapshot.funds.length });
      
      resolve(id);
    };
    
    request.onerror = () => {
      console.error('Failed to save snapshot:', request.error);
      reject(request.error);
    };
  });
}

/**
 * Get all snapshots (sorted by date descending)
 * @returns {Promise<Array>} Array of snapshots
 */
export async function getAllSnapshots() {
  const database = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.SNAPSHOTS], 'readonly');
    const store = transaction.objectStore(STORES.SNAPSHOTS);
    const request = store.getAll();
    
    request.onsuccess = () => {
      const snapshots = request.result || [];
      // Sort by date descending (newest first)
      snapshots.sort((a, b) => new Date(b.date) - new Date(a.date));
      resolve(snapshots);
    };
    
    request.onerror = () => {
      console.error('Failed to get snapshots:', request.error);
      reject(request.error);
    };
  });
}

/**
 * Get a specific snapshot by ID
 * @param {string} snapshotId - Snapshot ID
 * @returns {Promise<Object>} Snapshot data
 */
export async function getSnapshot(snapshotId) {
  const database = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.SNAPSHOTS], 'readonly');
    const store = transaction.objectStore(STORES.SNAPSHOTS);
    const request = store.get(snapshotId);
    
    request.onsuccess = () => {
      resolve(request.result);
    };
    
    request.onerror = () => {
      console.error('Failed to get snapshot:', request.error);
      reject(request.error);
    };
  });
}

/**
 * Delete a snapshot
 * @param {string} snapshotId - Snapshot ID to delete
 * @returns {Promise<void>}
 */
export async function deleteSnapshot(snapshotId) {
  const database = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.SNAPSHOTS], 'readwrite');
    const store = transaction.objectStore(STORES.SNAPSHOTS);
    const request = store.delete(snapshotId);
    
    request.onsuccess = () => {
      console.log('Snapshot deleted:', snapshotId);
      logAction('snapshot_deleted', { snapshotId });
      resolve();
    };
    
    request.onerror = () => {
      console.error('Failed to delete snapshot:', request.error);
      reject(request.error);
    };
  });
}

/**
 * Get snapshots within a date range
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<Array>} Filtered snapshots
 */
export async function getSnapshotsByDateRange(startDate, endDate) {
  const allSnapshots = await getAllSnapshots();
  return allSnapshots.filter(snapshot => {
    const snapshotDate = new Date(snapshot.date);
    return snapshotDate >= startDate && snapshotDate <= endDate;
  });
}

/**
 * Save configuration (recommended funds, benchmarks, etc.)
 * @param {string} key - Config key
 * @param {any} value - Config value
 * @returns {Promise<void>}
 */
export async function saveConfig(key, value) {
  const database = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.CONFIG], 'readwrite');
    const store = transaction.objectStore(STORES.CONFIG);
    
    const data = {
      key,
      value,
      lastModified: new Date().toISOString()
    };
    
    const request = store.put(data);
    
    request.onsuccess = () => {
      console.log('Config saved:', key);
      logAction('config_updated', { key });
      resolve();
    };
    
    request.onerror = () => {
      console.error('Failed to save config:', request.error);
      reject(request.error);
    };
  });
}

/**
 * Get configuration value
 * @param {string} key - Config key
 * @returns {Promise<any>} Config value
 */
export async function getConfig(key) {
  const database = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.CONFIG], 'readonly');
    const store = transaction.objectStore(STORES.CONFIG);
    const request = store.get(key);
    
    request.onsuccess = () => {
      resolve(request.result?.value);
    };
    
    request.onerror = () => {
      console.error('Failed to get config:', request.error);
      reject(request.error);
    };
  });
}

/**
 * Save user preferences
 * @param {string} key - Preference key
 * @param {any} value - Preference value
 * @returns {Promise<void>}
 */
export async function savePreference(key, value) {
  const database = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.PREFERENCES], 'readwrite');
    const store = transaction.objectStore(STORES.PREFERENCES);
    
    const data = {
      key,
      value,
      lastModified: new Date().toISOString()
    };
    
    const request = store.put(data);
    
    request.onsuccess = () => {
      resolve();
    };
    
    request.onerror = () => {
      console.error('Failed to save preference:', request.error);
      reject(request.error);
    };
  });
}

/**
 * Get user preference
 * @param {string} key - Preference key
 * @returns {Promise<any>} Preference value
 */
export async function getPreference(key) {
  const database = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.PREFERENCES], 'readonly');
    const store = transaction.objectStore(STORES.PREFERENCES);
    const request = store.get(key);
    
    request.onsuccess = () => {
      resolve(request.result?.value);
    };
    
    request.onerror = () => {
      console.error('Failed to get preference:', request.error);
      reject(request.error);
    };
  });
}

/**
 * Log an action for audit trail
 * @param {string} action - Action type
 * @param {Object} details - Action details
 * @returns {Promise<void>}
 */
async function logAction(action, details) {
  const database = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.AUDIT_LOG], 'readwrite');
    const store = transaction.objectStore(STORES.AUDIT_LOG);
    
    const entry = {
      action,
      details,
      timestamp: new Date().toISOString(),
      user: 'user' // In future, this could be the actual user
    };
    
    const request = store.add(entry);
    
    request.onsuccess = () => {
      resolve();
    };
    
    request.onerror = () => {
      // Don't reject main operation if logging fails
      console.warn('Failed to log action:', request.error);
      resolve();
    };
  });
}

/**
 * Get audit log entries
 * @param {number} limit - Maximum number of entries to return
 * @returns {Promise<Array>} Audit log entries
 */
export async function getAuditLog(limit = 100) {
  const database = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.AUDIT_LOG], 'readonly');
    const store = transaction.objectStore(STORES.AUDIT_LOG);
    const index = store.index('timestamp');
    
    const entries = [];
    let count = 0;
    
    // Open cursor in reverse order (newest first)
    const request = index.openCursor(null, 'prev');
    
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor && count < limit) {
        entries.push(cursor.value);
        count++;
        cursor.continue();
      } else {
        resolve(entries);
      }
    };
    
    request.onerror = () => {
      console.error('Failed to get audit log:', request.error);
      reject(request.error);
    };
  });
}

/**
 * Compare two snapshots
 * @param {string} snapshotId1 - First snapshot ID
 * @param {string} snapshotId2 - Second snapshot ID
 * @returns {Promise<Object>} Comparison results
 */
export async function compareSnapshots(snapshotId1, snapshotId2) {
  const [snapshot1, snapshot2] = await Promise.all([
    getSnapshot(snapshotId1),
    getSnapshot(snapshotId2)
  ]);
  
  if (!snapshot1 || !snapshot2) {
    throw new Error('One or both snapshots not found');
  }
  
  const comparison = {
    snapshot1: { id: snapshotId1, date: snapshot1.date },
    snapshot2: { id: snapshotId2, date: snapshot2.date },
    changes: []
  };
  
  // Create maps for easier lookup
  const funds1Map = new Map(snapshot1.funds.map(f => [f.Symbol, f]));
  const funds2Map = new Map(snapshot2.funds.map(f => [f.Symbol, f]));
  
  // Find changes in scores
  funds2Map.forEach((fund2, symbol) => {
    const fund1 = funds1Map.get(symbol);
    
    if (fund1 && fund1.scores && fund2.scores) {
      const scoreDiff = fund2.scores.final - fund1.scores.final;
      
      if (Math.abs(scoreDiff) > 0) {
        comparison.changes.push({
          symbol,
          fundName: fund2['Fund Name'],
          assetClass: fund2['Asset Class'],
          oldScore: fund1.scores.final,
          newScore: fund2.scores.final,
          change: scoreDiff,
          changePercent: ((scoreDiff / fund1.scores.final) * 100).toFixed(1)
        });
      }
    } else if (!fund1) {
      // New fund
      comparison.changes.push({
        symbol,
        fundName: fund2['Fund Name'],
        assetClass: fund2['Asset Class'],
        type: 'new',
        newScore: fund2.scores?.final
      });
    }
  });
  
  // Find removed funds
  funds1Map.forEach((fund1, symbol) => {
    if (!funds2Map.has(symbol)) {
      comparison.changes.push({
        symbol,
        fundName: fund1['Fund Name'],
        assetClass: fund1['Asset Class'],
        type: 'removed',
        oldScore: fund1.scores?.final
      });
    }
  });
  
  // Sort by absolute change
  comparison.changes.sort((a, b) => {
    const changeA = Math.abs(a.change || 0);
    const changeB = Math.abs(b.change || 0);
    return changeB - changeA;
  });
  
  return comparison;
}

/**
 * Export all data for backup
 * @returns {Promise<Object>} All data
 */
export async function exportAllData() {
  const [snapshots, config, preferences, auditLog] = await Promise.all([
    getAllSnapshots(),
    getAllConfig(),
    getAllPreferences(),
    getAuditLog(1000)
  ]);
  
  return {
    version: DB_VERSION,
    exportDate: new Date().toISOString(),
    snapshots,
    config,
    preferences,
    auditLog
  };
}

/**
 * Import data from backup
 * @param {Object} data - Data to import
 * @returns {Promise<void>}
 */
export async function importData(data) {
  if (data.version !== DB_VERSION) {
    console.warn('Version mismatch, data might need migration');
  }
  
  // Import snapshots
  if (data.snapshots) {
    for (const snapshot of data.snapshots) {
      await saveSnapshot(snapshot);
    }
  }
  
  // Import config
  if (data.config) {
    for (const item of data.config) {
      await saveConfig(item.key, item.value);
    }
  }
  
  // Import preferences
  if (data.preferences) {
    for (const item of data.preferences) {
      await savePreference(item.key, item.value);
    }
  }
  
  logAction('data_imported', { 
    snapshotsCount: data.snapshots?.length || 0,
    configCount: data.config?.length || 0
  });
}

// Helper functions for getting all config/preferences
async function getAllConfig() {
  const database = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.CONFIG], 'readonly');
    const store = transaction.objectStore(STORES.CONFIG);
    const request = store.getAll();
    
    request.onsuccess = () => {
      resolve(request.result || []);
    };
    
    request.onerror = () => {
      reject(request.error);
    };
  });
}

async function getAllPreferences() {
  const database = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.PREFERENCES], 'readonly');
    const store = transaction.objectStore(STORES.PREFERENCES);
    const request = store.getAll();
    
    request.onsuccess = () => {
      resolve(request.result || []);
    };
    
    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Clear all data (for testing or reset)
 * @returns {Promise<void>}
 */
export async function clearAllData() {
  const database = await openDB();
  
  const stores = [STORES.SNAPSHOTS, STORES.CONFIG, STORES.PREFERENCES, STORES.AUDIT_LOG];
  const transaction = database.transaction(stores, 'readwrite');
  
  const promises = stores.map(storeName => {
    return new Promise((resolve, reject) => {
      const store = transaction.objectStore(storeName);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  });
  
  await Promise.all(promises);
  logAction('data_cleared', { timestamp: new Date().toISOString() });
}

export default {
  saveSnapshot,
  getAllSnapshots,
  getSnapshot,
  deleteSnapshot,
  getSnapshotsByDateRange,
  saveConfig,
  getConfig,
  savePreference,
  getPreference,
  getAuditLog,
  compareSnapshots,
  exportAllData,
  importData,
  clearAllData
};