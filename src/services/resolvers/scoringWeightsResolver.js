// src/services/resolvers/scoringWeightsResolver.js
import scoringProfilesService from '../scoringProfilesService';
import { dbUtils } from '../supabase';
import { DEFAULT_WEIGHTS } from '../scoring';

/**
 * Scoring Weights Resolver
 * Loads active profile and constructs a precedence-aware weight lookup.
 * Precedence: fund -> asset_class -> global -> DEFAULT_WEIGHTS.
 *
 * Usage:
 *   const resolver = await buildWeightsResolver();
 *   const getWeight = resolver.getWeightFor(fund, 'sharpeRatio3Y');
 */
export async function buildWeightsResolver() {
  const envPref = process.env.REACT_APP_SCORING_PROFILE;

  // 1) Determine active profile
  let profile = null;
  if (envPref) {
    profile = await scoringProfilesService.getProfileByNameOrId(envPref);
  }
  if (!profile) {
    profile = await scoringProfilesService.getDefaultProfile();
  }

  // If still none (tests/no DB), synthesize a virtual profile with defaults
  const profileId = profile?.id || '__virtual_default__';

  // 2) Load weights rows (or synthesize from DEFAULT_WEIGHTS)
  let rows = [];
  if (profile?.id) {
    rows = await scoringProfilesService.listWeights(profile.id);
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    rows = Object.entries(DEFAULT_WEIGHTS).map(([metric_key, weight]) => ({
      profile_id: profileId,
      metric_key,
      scope: 'global',
      scope_value: null,
      weight,
      enabled: true
    }));
  }

  // 3) Build maps by scope
  const globalWeights = new Map();
  const classWeights = new Map(); // key: `${assetClass}::${metric}`
  const fundWeights = new Map();  // key: `${ticker}::${metric}`

  for (const r of rows) {
    if (!r?.enabled) continue;
    const metric = String(r.metric_key);
    const weight = Number(r.weight);
    if (r.scope === 'global') {
      globalWeights.set(metric, weight);
    } else if (r.scope === 'asset_class') {
      const ac = (r.scope_value || '').trim();
      if (!ac) continue;
      classWeights.set(`${ac}::${metric}`, weight);
    } else if (r.scope === 'fund') {
      const ticker = dbUtils.cleanSymbol(r.scope_value || '');
      if (!ticker) continue;
      fundWeights.set(`${ticker}::${metric}`, weight);
    }
  }

  // 4) Provide runtime getter
  function getWeightFor(fund, metricKey) {
    const ticker = dbUtils.cleanSymbol(fund?.ticker || fund?.Symbol || fund?.symbol || '');
    const assetClass = fund?.asset_class_name || fund?.asset_class || fund?.['Asset Class'] || '';

    // fund override
    const fKey = ticker ? `${ticker}::${metricKey}` : null;
    if (fKey && fundWeights.has(fKey)) return fundWeights.get(fKey);

    // asset_class override
    const cKey = assetClass ? `${assetClass}::${metricKey}` : null;
    if (cKey && classWeights.has(cKey)) return classWeights.get(cKey);

    // global
    if (globalWeights.has(metricKey)) return globalWeights.get(metricKey);

    // fallback baked-in
    return DEFAULT_WEIGHTS[metricKey];
  }

  function getWeightSource(fund, metricKey) {
    const ticker = dbUtils.cleanSymbol(fund?.ticker || fund?.Symbol || fund?.symbol || '');
    const assetClass = fund?.asset_class_name || fund?.asset_class || fund?.['Asset Class'] || '';
    const fKey = ticker ? `${ticker}::${metricKey}` : null;
    if (fKey && fundWeights.has(fKey)) return { source: 'fund', key: fKey, weight: fundWeights.get(fKey) };
    const cKey = assetClass ? `${assetClass}::${metricKey}` : null;
    if (cKey && classWeights.has(cKey)) return { source: 'asset_class', key: cKey, weight: classWeights.get(cKey) };
    if (globalWeights.has(metricKey)) return { source: 'global', key: metricKey, weight: globalWeights.get(metricKey) };
    return { source: 'default', key: metricKey, weight: DEFAULT_WEIGHTS[metricKey] };
  }

  // Dump effective map for debugging/preview
  function debugSnapshot() {
    return {
      profile: profile || { id: profileId, name: 'Default (virtual)' },
      counts: {
        global: globalWeights.size,
        class: classWeights.size,
        fund: fundWeights.size
      }
    };
  }

  return { profile, getWeightFor, getWeightSource, debugSnapshot };
}

