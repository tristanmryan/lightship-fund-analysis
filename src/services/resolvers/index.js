// src/services/resolvers/index.js
import { clearBenchmarkCache } from './benchmarkResolverClient.js';

export function invalidateReferenceCaches() {
  clearBenchmarkCache();
  // Asset class resolver caches removed - fundDataService provides clean data directly
}

