// src/services/resolvers/assetClassResolver.js
import { supabase, TABLES } from '../supabase.js';

const FLAG_SUPABASE_FIRST = (process.env.REACT_APP_RESOLVER_SUPABASE_FIRST || 'true') === 'true';
const FLAG_LEGACY_SHIM = (process.env.REACT_APP_ENABLE_LEGACY_ASSETCLASS_SHIM || 'true') === 'true';

// Simple caches to reduce round-trips
const assetClassByIdCache = new Map(); // id -> { id, code, name, group_name }
const assetClassByLabelCache = new Map(); // labelLower -> { id, code, name }

async function fetchAssetClassByIdInternal(id) {
  if (!id) return null;
  if (assetClassByIdCache.has(id)) return assetClassByIdCache.get(id);
  const { data, error } = await supabase
    .from(TABLES.ASSET_CLASSES)
    .select('id, code, name, group_name')
    .eq('id', id)
    .maybeSingle();
  if (error) return null;
  if (data) assetClassByIdCache.set(id, data);
  return data || null;
}

async function resolveByLabel(label) {
  if (!label) return null;
  const key = String(label).toLowerCase();
  if (assetClassByLabelCache.has(key)) return assetClassByLabelCache.get(key);

  // Try direct name match
  let { data, error } = await supabase
    .from(TABLES.ASSET_CLASSES)
    .select('id, code, name')
    .ilike('name', label);
  if (!error && data && data.length > 0) {
    assetClassByLabelCache.set(key, data[0]);
    return data[0];
  }

  // Try synonyms
  const { data: syns } = await supabase
    .from(TABLES.ASSET_CLASS_SYNONYMS)
    .select('code')
    .ilike('label', label);
  if (syns && syns.length > 0) {
    const { data: ac } = await supabase
      .from(TABLES.ASSET_CLASSES)
      .select('id, code, name')
      .eq('code', syns[0].code)
      .maybeSingle();
    if (ac) {
      assetClassByLabelCache.set(key, ac);
      return ac;
    }
  }
  return null;
}

/**
 * Service-side resolver used by fundService when saving/updating funds.
 * Precedence: fund_overrides > existing fund.asset_class_id > synonyms/name > apiSuggestedClass > null
 */
export async function resolveAssetClassForTicker(ticker, apiSuggestedClass = null) {
  const cleanTicker = ticker?.toUpperCase();
  if (!cleanTicker) return { asset_class_id: null, asset_class_name: null };

  if (FLAG_SUPABASE_FIRST) {
    // Fund-specific override
    const nowIso = new Date().toISOString();
    const { data: overrides } = await supabase
      .from(TABLES.FUND_OVERRIDES)
      .select('asset_class_id')
      .eq('fund_ticker', cleanTicker)
      .eq('override_type', 'asset_class')
      .is('benchmark_id', null)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .limit(1);
    if (overrides && overrides[0]?.asset_class_id) {
      const ac = await fetchAssetClassByIdInternal(overrides[0].asset_class_id);
      return { asset_class_id: ac?.id || overrides[0].asset_class_id, asset_class_name: ac?.name || null };
    }

    // Existing fund row
    const { data: fundRow } = await supabase
      .from(TABLES.FUNDS)
      .select('asset_class_id, asset_class')
      .eq('ticker', cleanTicker)
      .maybeSingle();
    if (fundRow?.asset_class_id) {
      const ac = await fetchAssetClassByIdInternal(fundRow.asset_class_id);
      return { asset_class_id: ac?.id || fundRow.asset_class_id, asset_class_name: ac?.name || fundRow.asset_class || null };
    }

    // Try mapping suggested/legacy string via synonyms
    const label = apiSuggestedClass || fundRow?.asset_class || null;
    if (label) {
      const ac = await resolveByLabel(label);
      if (ac) return { asset_class_id: ac.id, asset_class_name: ac.name };
    }
  }

  if (FLAG_LEGACY_SHIM) {
    const fallback = apiSuggestedClass || null;
    return { asset_class_id: null, asset_class_name: fallback };
  }

  return { asset_class_id: null, asset_class_name: null };
}

/**
 * Client-side helper: given a fund object, return a normalized display name
 */
export async function resolveAssetClassDisplay(fund) {
  if (!fund) return null;
  if (FLAG_SUPABASE_FIRST && fund.asset_class_id) {
    const ac = await fetchAssetClassByIdInternal(fund.asset_class_id);
    if (ac?.name) return ac.name;
  }
  if (FLAG_LEGACY_SHIM) return fund.asset_class_name || fund.asset_class || fund['Asset Class'] || null;
  return null;
}

// Expose cache clear for admin updates
export function clearAssetClassResolverCaches() {
  assetClassByIdCache.clear();
  assetClassByLabelCache.clear();
}

