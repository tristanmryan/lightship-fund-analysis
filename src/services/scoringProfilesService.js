// src/services/scoringProfilesService.js
import { supabase, TABLES, dbUtils, handleSupabaseError } from './supabase';

/**
 * Scoring Profiles Service
 * CRUD helpers for profiles and weights. All functions are safe in tests (stubbed supabase).
 */
class ScoringProfilesService {
  async listProfiles() {
    try {
      const { data, error } = await supabase
        .from(TABLES.SCORING_PROFILES)
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    } catch (error) {
      handleSupabaseError(error, 'listProfiles');
      return [];
    }
  }

  async getDefaultProfile() {
    try {
      const { data, error } = await supabase
        .from(TABLES.SCORING_PROFILES)
        .select('*')
        .eq('is_default', true)
        .maybeSingle();
      if (error) throw error;
      return data;
    } catch (error) {
      handleSupabaseError(error, 'getDefaultProfile');
      return null;
    }
  }

  async getProfileByNameOrId(nameOrId) {
    if (!nameOrId) return null;
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(nameOrId));
      const query = supabase.from(TABLES.SCORING_PROFILES).select('*');
      const { data, error } = isUuid
        ? await query.eq('id', nameOrId).maybeSingle()
        : await query.eq('name', String(nameOrId)).maybeSingle();
      if (error) throw error;
      return data;
    } catch (error) {
      handleSupabaseError(error, 'getProfileByNameOrId');
      return null;
    }
  }

  async upsertProfile({ id = null, name, description = '', is_default = false }) {
    try {
      const payload = { name, description, is_default };
      if (id) payload.id = id;
      const { data, error } = await supabase
        .from(TABLES.SCORING_PROFILES)
        .upsert(payload, { onConflict: 'name' })
        .select()
        .maybeSingle();
      if (error) throw error;
      return data;
    } catch (error) {
      handleSupabaseError(error, 'upsertProfile');
      throw error;
    }
  }

  async listWeights(profileId) {
    if (!profileId) return [];
    try {
      const { data, error } = await supabase
        .from(TABLES.SCORING_WEIGHTS)
        .select('*')
        .eq('profile_id', profileId)
        .order('metric_key', { ascending: true });
      if (error) throw error;
      return data || [];
    } catch (error) {
      handleSupabaseError(error, 'listWeights');
      return [];
    }
  }

  async upsertWeight({ profile_id, metric_key, scope = 'global', scope_value = null, weight, enabled = true }) {
    try {
      const payload = {
        profile_id,
        metric_key,
        scope,
        scope_value: scope === 'fund' ? dbUtils.cleanSymbol(scope_value) : (scope_value || null),
        weight,
        enabled,
        updated_at: new Date().toISOString()
      };
      const { data, error } = await supabase
        .from(TABLES.SCORING_WEIGHTS)
        .upsert(payload, { onConflict: 'profile_id,metric_key,scope,scope_value' })
        .select()
        .maybeSingle();
      if (error) throw error;
      return data;
    } catch (error) {
      handleSupabaseError(error, 'upsertWeight');
      throw error;
    }
  }

  async deleteWeight({ profile_id, metric_key, scope = 'global', scope_value = null }) {
    try {
      const builder = supabase
        .from(TABLES.SCORING_WEIGHTS)
        .delete()
        .eq('profile_id', profile_id)
        .eq('metric_key', metric_key)
        .eq('scope', scope);
      const { error } = scope_value == null
        ? await builder.is('scope_value', null)
        : await builder.eq('scope_value', scope === 'fund' ? dbUtils.cleanSymbol(scope_value) : scope_value);
      if (error) throw error;
      return true;
    } catch (error) {
      handleSupabaseError(error, 'deleteWeight');
      return false;
    }
  }
}

const scoringProfilesService = new ScoringProfilesService();
export default scoringProfilesService;

/**
 * Asset Class <-> Scoring Profile Mapping Service
 */
export class AssetClassProfileMapping {
  constructor() {
    this.mappingCache = new Map();
  }

  async getAssetClasses() {
    try {
      const { data, error } = await supabase
        .from(TABLES.ASSET_CLASSES)
        .select('id, code, name, group_name, sort_group, sort_order')
        .order('sort_group', { ascending: true })
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data || [];
    } catch (error) {
      handleSupabaseError(error, 'getAssetClasses');
      return [];
    }
  }

  async getProfileForAssetClass(assetClassId) {
    if (!assetClassId) return null;
    
    // Check cache first
    if (this.mappingCache.has(assetClassId)) {
      return this.mappingCache.get(assetClassId);
    }

    try {
      // For now, return the default profile
      // In the future, this could be stored in a separate mapping table
      const defaultProfile = await scoringProfilesService.getDefaultProfile();
      this.mappingCache.set(assetClassId, defaultProfile);
      return defaultProfile;
    } catch (error) {
      handleSupabaseError(error, 'getProfileForAssetClass');
      return null;
    }
  }

  async setProfileForAssetClass(assetClassId, profileId) {
    // For now, this is a no-op as we're using default profile for all asset classes
    // In the future, this would store the mapping in a database table
    console.log('Asset class profile mapping not yet implemented:', { assetClassId, profileId });
    
    // Clear cache
    this.mappingCache.delete(assetClassId);
    
    return true;
  }

  clearCache() {
    this.mappingCache.clear();
  }
}

export const assetClassProfileMapping = new AssetClassProfileMapping();

