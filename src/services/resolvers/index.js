// src/services/resolvers/index.js
import { clearBenchmarkCache } from './benchmarkResolverClient';
import { clearAssetClassResolverCaches } from './assetClassResolver';

export function invalidateReferenceCaches() {
  clearBenchmarkCache();
  clearAssetClassResolverCaches();
}

