import { calculateScores, generateClassSummary } from './scoring.js';
import { getGroupForAssetClass } from '../data/assetClassGroups.js';

export function processRawFunds(rawFunds = [], options = {}) {
  const { recommendedFunds = [], benchmarks = {} } = options;
  const clean = (s) => s?.toUpperCase().trim().replace(/[^A-Z0-9]/g, '');

  const recommendedMap = {};
  recommendedFunds.forEach(f => {
    recommendedMap[clean(f.symbol)] = f;
  });

  const benchmarkMap = {};
  Object.entries(benchmarks).forEach(([assetClass, bench]) => {
    benchmarkMap[clean(bench.ticker)] = { assetClass, name: bench.name };
  });

  const enriched = rawFunds.map(f => {
    const parsedSymbol = clean(f.Symbol);
    const rec = recommendedMap[parsedSymbol];
    const benchInfo = benchmarkMap[parsedSymbol];

    const assetClass = rec ? rec.assetClass : (benchInfo ? benchInfo.assetClass : 'Unknown');

    return {
      ...f,
      Symbol: f.Symbol,
      cleanSymbol: parsedSymbol,
      displayName: rec ? rec.name : f['Fund Name'],
      'Asset Class': assetClass,
      assetGroup: getGroupForAssetClass(assetClass),
      isRecommended: !!rec,
      isBenchmark: !!benchInfo,
      benchmarkForClass: benchInfo ? benchInfo.assetClass : null
    };
  });

  const scoredFunds = calculateScores(enriched);

  const fundsByClass = {};
  scoredFunds.forEach(f => {
    const cls = f['Asset Class'];
    if (!fundsByClass[cls]) fundsByClass[cls] = [];
    fundsByClass[cls].push(f);
  });

  const classSummaries = {};
  Object.entries(fundsByClass).forEach(([cls, funds]) => {
    classSummaries[cls] = generateClassSummary(funds);
  });

  const benchmarkData = {};
  Object.entries(benchmarks).forEach(([assetClass, { ticker, name }]) => {
    const match = scoredFunds.find(f => f.cleanSymbol === clean(ticker));
    if (match) benchmarkData[assetClass] = { ...match, name };
  });

  return { scoredFunds, classSummaries, benchmarks: benchmarkData };
}
