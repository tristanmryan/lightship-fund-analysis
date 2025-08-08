// src/components/Dashboard/benchmarkUtils.js
// Thin UI helper. Actual resolution uses resolver services (Supabase-first),
// with optional config fallback under feature flags during migration.
import { getPrimaryBenchmark, resolveAssetClass as resolveAssetClassViaResolver } from '../../services/resolvers/benchmarkResolverClient';

export function resolveAssetClass(fund) {
  return resolveAssetClassViaResolver(fund);
}

export function getBenchmarkConfigForFund(fund) {
  const resolved = getPrimaryBenchmark(fund);
  return resolved;
}

export function findBenchmarkFundInList(funds, ticker) {
  if (!ticker || !Array.isArray(funds)) return null;
  return funds.find(f => (f.Symbol || f.ticker) === ticker) || null;
}

export function getMetricValueForKey(fund, key) {
  if (!fund) return null;
  switch (key) {
    case 'ytd':
      return fund['Total Return - YTD (%)'] ?? fund.ytd_return ?? null;
    case '1y':
      return fund['Total Return - 1 Year (%)'] ?? fund.one_year_return ?? fund['1 Year'] ?? null;
    case '3y':
      return fund['Annualized Total Return - 3 Year (%)'] ?? fund.three_year_return ?? fund['3 Year'] ?? null;
    case '5y':
      return fund['Annualized Total Return - 5 Year (%)'] ?? fund.five_year_return ?? fund['5 Year'] ?? null;
    case 'sharpe':
      return fund['Sharpe Ratio - 3 Year'] ?? fund['Sharpe Ratio'] ?? fund.sharpe_ratio ?? null;
    default:
      return null;
  }
}

export function computeBenchmarkDelta(fund, funds, key = '1y') {
  const benchCfg = getBenchmarkConfigForFund(fund);
  if (!benchCfg) return null;
  const benchFund = findBenchmarkFundInList(funds, benchCfg.ticker);
  if (!benchFund) return {
    delta: null,
    benchValue: null,
    benchTicker: benchCfg.ticker,
    benchName: benchCfg.name
  };

  const fundVal = getMetricValueForKey(fund, key);
  const benchVal = getMetricValueForKey(benchFund, key);
  if (fundVal == null || benchVal == null) {
    return {
      delta: null,
      benchValue: benchVal,
      benchTicker: benchCfg.ticker,
      benchName: benchCfg.name
    };
  }

  const delta = fundVal - benchVal;
  return {
    delta,
    benchValue: benchVal,
    benchTicker: benchCfg.ticker,
    benchName: benchCfg.name
  };
}

