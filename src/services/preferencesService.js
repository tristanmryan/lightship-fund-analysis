// src/services/preferencesService.js
// Small wrapper around IndexedDB preferences with per-user namespacing

import authService from './authService.js';
import { getPreference, savePreference } from './dataStore.js';

const isEnabled = () => (process.env.REACT_APP_ENABLE_SAVED_VIEWS ?? 'true') !== 'false';

function getCurrentUserIdSafe() {
  try {
    const user = authService.getCurrentUser?.();
    return user?.id || 'guest';
  } catch {
    return 'guest';
  }
}

function buildKey(suffix) {
  const userId = getCurrentUserIdSafe();
  return `user:${userId}:${suffix}`;
}

// View defaults include: filters, table.sortConfig, table.selectedColumns
const VIEW_DEFAULTS_KEY_SUFFIX = 'view_defaults_v1';
const FILTER_PRESETS_KEY_SUFFIX = 'filter_presets_v1';
const COMPARE_SETS_KEY_SUFFIX = 'compare_sets_v1';
const DASHBOARD_WIDGETS_KEY_SUFFIX = 'dashboard_widgets_v1';

const DEFAULT_FILTERS = {
  search: '',
  assetClasses: [],
  performanceRank: null,
  expenseRatioMax: null,
  sharpeRatioMin: null,
  betaMax: null,
  timePerformance: { period: null, minReturn: null, maxReturn: null },
  scoreRange: { min: null, max: null },
  isRecommended: null
};

function sanitizeViewDefaultsShape(view) {
  if (!view || typeof view !== 'object') return null;
  const safeFilters = {
    ...DEFAULT_FILTERS,
    ...(view.filters || {}),
    assetClasses: Array.isArray(view?.filters?.assetClasses) ? view.filters.assetClasses : [],
    timePerformance: { ...DEFAULT_FILTERS.timePerformance, ...(view?.filters?.timePerformance || {}) },
    scoreRange: { ...DEFAULT_FILTERS.scoreRange, ...(view?.filters?.scoreRange || {}) }
  };
  return { ...view, filters: safeFilters };
}

export async function getViewDefaults() {
  if (!isEnabled()) return null;
  const key = buildKey(VIEW_DEFAULTS_KEY_SUFFIX);
  try {
    const raw = await getPreference(key);
    return sanitizeViewDefaultsShape(raw);
  } catch {
    return null;
  }
}

export async function saveViewDefaults(preferences) {
  if (!isEnabled()) return;
  const key = buildKey(VIEW_DEFAULTS_KEY_SUFFIX);
  await savePreference(key, preferences);
}

export async function clearViewDefaults() {
  if (!isEnabled()) return;
  const key = buildKey(VIEW_DEFAULTS_KEY_SUFFIX);
  // IndexedDB objectStore.put requires a value; we emulate clear by saving null
  await savePreference(key, null);
}

export async function getFilterPresets() {
  if (!isEnabled()) return null;
  const key = buildKey(FILTER_PRESETS_KEY_SUFFIX);
  try {
    return await getPreference(key);
  } catch {
    return null;
  }
}

export async function saveFilterPresets(presets) {
  if (!isEnabled()) return;
  const key = buildKey(FILTER_PRESETS_KEY_SUFFIX);
  await savePreference(key, presets || {});
}

export async function getCompareSets() {
  if (!isEnabled()) return null;
  const key = buildKey(COMPARE_SETS_KEY_SUFFIX);
  try {
    return await getPreference(key);
  } catch {
    return null;
  }
}

export async function saveCompareSets(compareSets) {
  if (!isEnabled()) return;
  const key = buildKey(COMPARE_SETS_KEY_SUFFIX);
  await savePreference(key, compareSets || {});
}

// Dashboard widgets visibility
export async function getDashboardWidgets() {
  if (!isEnabled()) return null;
  const key = buildKey(DASHBOARD_WIDGETS_KEY_SUFFIX);
  try {
    return await getPreference(key);
  } catch {
    return null;
  }
}

export async function saveDashboardWidgets(config) {
  if (!isEnabled()) return;
  const key = buildKey(DASHBOARD_WIDGETS_KEY_SUFFIX);
  await savePreference(key, config || {});
}

const preferencesApi = {
  getViewDefaults,
  saveViewDefaults,
  clearViewDefaults,
  getFilterPresets,
  saveFilterPresets,
  getCompareSets,
  saveCompareSets,
  getDashboardWidgets,
  saveDashboardWidgets
};

export default preferencesApi;

