/**
 * Weight Management Service for Clean Scoring System
 * 
 * This service provides a simple 2-tier weight management system:
 * 1. Global default weights (from scoringService.js)
 * 2. Asset class-specific weight overrides (stored in database)
 * 
 * Key features:
 * - Simple CRUD operations for asset class weights
 * - Real-time capable for admin interface
 * - Always falls back to global defaults
 * - Database persistence with simple schema
 */

import { supabase } from './supabase.js';
import { DEFAULT_WEIGHTS } from './metricsRegistry.js';

// Table name for weight storage
const WEIGHTS_TABLE = 'scoring_weights_simple';

/**
 * Get global default weights from database or fallback to hardcoded defaults
 * @returns {Promise<Object>} Global default weights object
 */
export async function getGlobalDefaultWeights() {
  try {
    // Try to find the Global Defaults asset class
    const { data: globalAssetClass, error: selectError } = await supabase
      .from('asset_classes')
      .select('id')
      .eq('name', 'Global Defaults')
      .single();

    if (selectError || !globalAssetClass) {
      // No Global Defaults asset class exists, use hardcoded defaults
      return { ...DEFAULT_WEIGHTS };
    }

    // Get global default weights from database
    const { data: globalWeights, error } = await supabase
      .from(WEIGHTS_TABLE)
      .select('metric_key, weight')
      .eq('asset_class_id', globalAssetClass.id);

    if (error) {
      console.warn('Error loading global default weights from database:', error);
      return { ...DEFAULT_WEIGHTS }; // Fallback to hardcoded defaults
    }

    // If we have global defaults in database, use them
    if (globalWeights && globalWeights.length > 0) {
      const weights = { ...DEFAULT_WEIGHTS }; // Start with hardcoded defaults
      globalWeights.forEach(({ metric_key, weight }) => {
        weights[metric_key] = parseFloat(weight);
      });
      return weights;
    }

    // No global defaults in database, use hardcoded defaults
    return { ...DEFAULT_WEIGHTS };

  } catch (error) {
    console.error('Failed to load global default weights:', error);
    return { ...DEFAULT_WEIGHTS }; // Fallback to hardcoded defaults
  }
}

/**
 * Get global default weights synchronously (for backward compatibility)
 * This version doesn't check the database and always returns hardcoded defaults
 * @returns {Object} Global default weights object
 */
export function getGlobalDefaultWeightsSync() {
  return { ...DEFAULT_WEIGHTS }; // Return copy to prevent mutations
}

/**
 * Save new global default weights to database
 * Uses a special "Global Defaults" asset class to store global defaults
 * @param {Object} weights - Weights object to save as global defaults
 * @returns {Promise<boolean>} Success status
 */
export async function saveGlobalDefaultWeights(weights) {
  if (!weights || typeof weights !== 'object') {
    throw new Error('Invalid weights object');
  }

  try {
    // First, ensure we have a "Global Defaults" asset class
    const globalAssetClassId = await ensureGlobalDefaultsAssetClass();
    
    // Delete existing global default weights
    const { error: deleteError } = await supabase
      .from(WEIGHTS_TABLE)
      .delete()
      .eq('asset_class_id', globalAssetClassId);

    if (deleteError) {
      throw new Error(`Failed to clear existing global defaults: ${deleteError.message}`);
    }

    // Prepare weight records for insertion
    const weightRecords = Object.entries(weights)
      .map(([metric_key, weight]) => ({
        asset_class_id: globalAssetClassId,
        metric_key,
        weight: parseFloat(weight)
      }));

    // Insert new global default weight records
    const { error: insertError } = await supabase
      .from(WEIGHTS_TABLE)
      .insert(weightRecords);

    if (insertError) {
      throw new Error(`Failed to save global defaults: ${insertError.message}`);
    }

    console.log(`Saved ${weightRecords.length} global default weights`);
    return true;

  } catch (error) {
    console.error('Failed to save global default weights:', error);
    throw error;
  }
}

/**
 * Ensure a "Global Defaults" asset class exists and return its ID
 * @returns {Promise<string>} UUID of the Global Defaults asset class
 */
async function ensureGlobalDefaultsAssetClass() {
  try {
    // First, try to find existing Global Defaults asset class
    const { data: existing, error: selectError } = await supabase
      .from('asset_classes')
      .select('id')
      .eq('name', 'Global Defaults')
      .single();

    if (existing && !selectError) {
      return existing.id;
    }

    // If not found, create it
    const { data: newAssetClass, error: insertError } = await supabase
      .from('asset_classes')
      .insert({
        name: 'Global Defaults',
        code: 'GLOBAL_DEFAULTS',
        description: 'Special asset class for storing global default scoring weights',
        group_name: 'System',
        sort_group: 999,
        sort_order: 999
      })
      .select('id')
      .single();

    if (insertError) {
      throw new Error(`Failed to create Global Defaults asset class: ${insertError.message}`);
    }

    return newAssetClass.id;

  } catch (error) {
    console.error('Failed to ensure Global Defaults asset class:', error);
    throw error;
  }
}

/**
 * Get weights for a specific asset class (with fallback to defaults)
 * @param {string|number} assetClassId - Asset class ID
 * @returns {Promise<Object>} Weights object for the asset class
 */
export async function getWeightsForAssetClass(assetClassId) {
  if (!assetClassId) {
    return await getGlobalDefaultWeights();
  }

  try {
    const { data: customWeights, error } = await supabase
      .from(WEIGHTS_TABLE)
      .select('metric_key, weight')
      .eq('asset_class_id', assetClassId);

    if (error) {
      console.warn(`Error loading weights for asset class ${assetClassId}:`, error);
      return await getGlobalDefaultWeights();
    }

    // If no custom weights found, return global defaults
    if (!customWeights || customWeights.length === 0) {
      return await getGlobalDefaultWeights();
    }

    // Merge custom weights with global defaults
    const globalDefaults = await getGlobalDefaultWeights();
    customWeights.forEach(({ metric_key, weight }) => {
      globalDefaults[metric_key] = parseFloat(weight);
    });

    return globalDefaults;

  } catch (error) {
    console.error(`Failed to load weights for asset class ${assetClassId}:`, error);
    return await getGlobalDefaultWeights();
  }
}

/**
 * Save asset class-specific weights to database
 * @param {string|number} assetClassId - Asset class ID
 * @param {Object} weights - Weights object to save
 * @returns {Promise<boolean>} Success status
 */
export async function saveAssetClassWeights(assetClassId, weights) {
  if (!assetClassId || !weights || typeof weights !== 'object') {
    throw new Error('Invalid asset class ID or weights object');
  }

  try {
    // First, delete existing weights for this asset class
    const { error: deleteError } = await supabase
      .from(WEIGHTS_TABLE)
      .delete()
      .eq('asset_class_id', assetClassId);

    if (deleteError) {
      throw new Error(`Failed to clear existing weights: ${deleteError.message}`);
    }

    // Prepare weight records for insertion
    const weightRecords = Object.entries(weights)
      .map(([metric_key, weight]) => ({
        asset_class_id: assetClassId,
        metric_key,
        weight: parseFloat(weight)
      }));

    // Note: We persist zero weights to explicitly disable metrics

    // Insert new weight records
    const { error: insertError } = await supabase
      .from(WEIGHTS_TABLE)
      .insert(weightRecords);

    if (insertError) {
      throw new Error(`Failed to save weights: ${insertError.message}`);
    }

    console.log(`Saved ${weightRecords.length} custom weights for asset class ${assetClassId}`);
    return true;

  } catch (error) {
    console.error(`Failed to save weights for asset class ${assetClassId}:`, error);
    throw error;
  }
}

/**
 * Reset asset class to use global defaults (remove custom weights)
 * @param {string|number} assetClassId - Asset class ID
 * @returns {Promise<boolean>} Success status
 */
export async function resetAssetClassWeights(assetClassId) {
  if (!assetClassId) {
    throw new Error('Invalid asset class ID');
  }

  try {
    const { error } = await supabase
      .from(WEIGHTS_TABLE)
      .delete()
      .eq('asset_class_id', assetClassId);

    if (error) {
      throw new Error(`Failed to reset weights: ${error.message}`);
    }

    console.log(`Reset weights for asset class ${assetClassId} to global defaults`);
    return true;

  } catch (error) {
    console.error(`Failed to reset weights for asset class ${assetClassId}:`, error);
    throw error;
  }
}

/**
 * Get all asset classes that have custom weight overrides
 * @returns {Promise<Array>} Array of asset class info with custom weights
 */
export async function getAssetClassesWithCustomWeights() {
  try {
    const { data: weightData, error } = await supabase
      .from(WEIGHTS_TABLE)
      .select(`
        asset_class_id,
        asset_classes!inner(id, name, code)
      `);

    if (error) {
      console.warn('Error loading asset classes with custom weights:', error);
      return [];
    }

    if (!weightData || weightData.length === 0) {
      return [];
    }

    // Group by asset class and count custom weights
    const assetClassMap = new Map();
    weightData.forEach(row => {
      const acId = row.asset_class_id;
      if (!assetClassMap.has(acId)) {
        assetClassMap.set(acId, {
          id: acId,
          name: row.asset_classes.name,
          code: row.asset_classes.code,
          customWeightCount: 0
        });
      }
      assetClassMap.get(acId).customWeightCount++;
    });

    return Array.from(assetClassMap.values());

  } catch (error) {
    console.error('Failed to load asset classes with custom weights:', error);
    return [];
  }
}

/**
 * Get weights for multiple asset classes at once (bulk loading)
 * @param {Array<string|number>} assetClassIds - Array of asset class IDs
 * @returns {Promise<Object>} Map of asset class ID to weights object
 */
export async function getBulkWeightsForAssetClasses(assetClassIds) {
  if (!assetClassIds || assetClassIds.length === 0) {
    return {};
  }

  try {
    const { data: customWeights, error } = await supabase
      .from(WEIGHTS_TABLE)
      .select('asset_class_id, metric_key, weight')
      .in('asset_class_id', assetClassIds);

    if (error) {
      console.warn('Error loading bulk weights:', error);
      // Return global defaults for all asset classes
      const globalDefaults = await getGlobalDefaultWeights();
      const defaultWeights = {};
      assetClassIds.forEach(id => {
        defaultWeights[id] = { ...globalDefaults };
      });
      return defaultWeights;
    }

    // Get global defaults once
    const globalDefaults = await getGlobalDefaultWeights();
    
    // Group weights by asset class
    const weightsByAssetClass = {};
    assetClassIds.forEach(id => {
      weightsByAssetClass[id] = { ...globalDefaults };
    });

    if (customWeights && customWeights.length > 0) {
      customWeights.forEach(({ asset_class_id, metric_key, weight }) => {
        if (weightsByAssetClass[asset_class_id]) {
          weightsByAssetClass[asset_class_id][metric_key] = parseFloat(weight);
        }
      });
    }

    return weightsByAssetClass;

  } catch (error) {
    console.error('Failed to load bulk weights:', error);
    // Return global defaults for all asset classes
    const globalDefaults = await getGlobalDefaultWeights();
    const defaultWeights = {};
    assetClassIds.forEach(id => {
      defaultWeights[id] = { ...globalDefaults };
    });
    return defaultWeights;
  }
}

/**
 * Validate weights object (ensure all weights are numbers and sum to reasonable total)
 * @param {Object} weights - Weights object to validate
 * @returns {Object} Validation result with success flag and messages
 */
export function validateWeights(weights) {
  const result = {
    isValid: true,
    errors: [],
    warnings: []
  };

  if (!weights || typeof weights !== 'object') {
    result.isValid = false;
    result.errors.push('Weights must be an object');
    return result;
  }

  let totalWeight = 0;
  const defaultMetrics = Object.keys(DEFAULT_WEIGHTS);

  Object.entries(weights).forEach(([metric, weight]) => {
    // Check if metric is recognized
    if (!defaultMetrics.includes(metric)) {
      result.warnings.push(`Unknown metric: ${metric}`);
    }

    // Check if weight is a valid number
    if (typeof weight !== 'number' || isNaN(weight)) {
      result.isValid = false;
      result.errors.push(`Invalid weight for ${metric}: must be a number`);
      return;
    }

    // Check weight range (allow negative for expense_ratio, beta)
    if (Math.abs(weight) > 1) {
      result.warnings.push(`Large weight for ${metric}: ${weight} (>1.0)`);
    }

    totalWeight += Math.abs(weight);
  });

  // Check total weight magnitude
  if (totalWeight === 0) {
    result.warnings.push('All weights are zero - funds will not be scored');
  } else if (totalWeight > 2) {
    result.warnings.push(`High total weight: ${totalWeight.toFixed(2)} (consider normalizing)`);
  }

  return result;
}

/**
 * Utility function to get a formatted summary of weight differences from defaults (sync version)
 * This version uses hardcoded defaults for backward compatibility
 * @param {Object} weights - Current weights
 * @returns {Object} Summary of differences
 */
export function getWeightsDifferenceSummarySync(weights) {
  const defaults = getGlobalDefaultWeightsSync(); // Use sync version for fallback
  const differences = {};
  let totalDifferences = 0;

  Object.keys(defaults).forEach(metric => {
    const defaultWeight = defaults[metric];
    const currentWeight = weights[metric] || 0;
    const diff = currentWeight - defaultWeight;
    
    if (Math.abs(diff) > 0.001) { // Only count significant differences
      differences[metric] = {
        default: defaultWeight,
        current: currentWeight,
        difference: diff,
        percentChange: defaultWeight !== 0 ? (diff / defaultWeight) * 100 : 0
      };
      totalDifferences++;
    }
  });

  return {
    totalDifferences,
    differences,
    hasCustomWeights: totalDifferences > 0
  };
}

/**
 * Utility function to get a formatted summary of weight differences from defaults (async version)
 * This version uses actual global defaults from database
 * @param {Object} weights - Current weights
 * @returns {Promise<Object>} Summary of differences
 */
export async function getWeightsDifferenceSummary(weights) {
  const defaults = await getGlobalDefaultWeights(); // Use async version to get actual defaults
  const differences = {};
  let totalDifferences = 0;

  Object.keys(defaults).forEach(metric => {
    const defaultWeight = defaults[metric];
    const currentWeight = weights[metric] || 0;
    const diff = currentWeight - defaultWeight;
    
    if (Math.abs(diff) > 0.001) { // Only count significant differences
      differences[metric] = {
        default: defaultWeight,
        current: currentWeight,
        difference: diff,
        percentChange: defaultWeight !== 0 ? (diff / defaultWeight) * 100 : 0
      };
      totalDifferences++;
    }
  });

  return {
    totalDifferences,
    differences,
    hasCustomWeights: totalDifferences > 0
  };
}
