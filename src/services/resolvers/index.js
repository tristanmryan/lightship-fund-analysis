// src/services/resolvers/index.js
import { clearBenchmarkCache } from './benchmarkResolverClient.js';
import { clearAssetClassResolverCaches } from './assetClassResolver.js';

export function invalidateReferenceCaches() {
  clearBenchmarkCache();
  clearAssetClassResolverCaches();
}

