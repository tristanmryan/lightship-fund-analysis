// src/services/resolvers/benchmarkResolverClient.js
// Lightweight client-facing resolver wrappers that use Supabase-first logic
// with optional fallback to config during migration.

import { supabase, TABLES } from '../supabase';
import { assetClassBenchmarks as fallbackMap } from '../../data/config';

const FLAG_SUPABASE_FIRST = (process.env.REACT_APP_RESOLVER_SUPABASE_FIRST || 'true') === 'true';
const FLAG_CONFIG_FALLBACK = (process.env.REACT_APP_ENABLE_CONFIG_BENCHMARK_FALLBACK || 'true') === 'true';
const ALLOW_MOCK_IN_PROD = (process.env.REACT_APP_ALLOW_MOCK_FALLBACK || 'false') === 'true';

// Cache maps
const primaryBenchmarkByAssetClassId = new Map(); // id -> { ticker, name, id }

export function resolveAssetClass(fund) {
  // Synchronous best-effort; UI already has normalized fields from service when possible
  return fund?.asset_class_name || fund?.asset_class || fund?.['Asset Class'] || null;
}

export function getPrimaryBenchmarkSyncByLabel(label) {
  if (!label) return null;
  if (!FLAG_CONFIG_FALLBACK) return null;
  if (process.env.NODE_ENV === 'production' && !ALLOW_MOCK_IN_PROD) {
    // Disallow mock/config fallback in production unless explicitly allowed
    // eslint-disable-next-line no-console
    console.error('[Resolver] Mock fallback blocked in production');
    return null;
  }
  const cfg = fallbackMap[label];
  if (!cfg) return null;
  return { ticker: cfg.ticker, name: cfg.name };
}

export function getPrimaryBenchmark(fund) {
  // Try resolve via id
  const assetClassId = fund?.asset_class_id || null;
  const label = resolveAssetClass(fund);

  if (FLAG_SUPABASE_FIRST && assetClassId) {
    const cached = primaryBenchmarkByAssetClassId.get(assetClassId);
    if (cached) return cached;
  }

  // We intentionally keep this synchronous for UI calls; if Supabase data
  // is not in memory, fall back to config map during migration.
  const fallback = getPrimaryBenchmarkSyncByLabel(label);
  if (fallback) return fallback;

  // If no fallback exists, return null. Delta badge will hide.
  return null;
}

// Call once (e.g., after funds load) to warm cache from Supabase mappings
export async function prefetchBenchmarkMappings() {
  if (!FLAG_SUPABASE_FIRST) return;
  const { data, error } = await supabase
    .from(TABLES.ASSET_CLASS_BENCHMARKS)
    .select('asset_class_id, kind, rank, benchmarks(id, ticker, name)')
    .eq('kind', 'primary');
  if (error) return;
  for (const row of data || []) {
    if (row?.asset_class_id && row?.benchmarks) {
      primaryBenchmarkByAssetClassId.set(row.asset_class_id, {
        id: row.benchmarks.id,
        ticker: row.benchmarks.ticker,
        name: row.benchmarks.name
      });
    }
  }
}

export function clearBenchmarkCache() {
  primaryBenchmarkByAssetClassId.clear();
}

