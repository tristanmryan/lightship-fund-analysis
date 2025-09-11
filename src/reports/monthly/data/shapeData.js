/**
 * Data Shaping Service for Monthly PDF Reports
 * Fetches and normalizes fund data, resolves benchmarks, and structures for template consumption
 */

import { supabase, TABLES } from '../../../services/supabase.js';
import fundService from '../../../services/fundService.js';
import { calculateScores } from '../../../services/scoringService.js';
import { getBulkWeightsForAssetClasses } from '../../../services/weightService.js';
import { formatPercentDisplay, formatNumberDisplay, toEomDate } from '../shared/format.js';

// Helper function to apply new scoring system
async function applyNewScoring(fundData) {
  if (!fundData || fundData.length === 0) return [];
  
  // Get unique asset class IDs  
  const assetClassIds = [...new Set(
    fundData
      .filter(f => f.asset_class_id)
      .map(f => f.asset_class_id)
  )];
  
  // Load weights
  const weightsByAssetClass = assetClassIds.length > 0 
    ? await getBulkWeightsForAssetClasses(assetClassIds)
    : {};
  
  // Map to asset class names
  const weightsByAssetClassName = {};
  fundData.forEach(fund => {
    if (fund.asset_class_id && weightsByAssetClass[fund.asset_class_id]) {
      const assetClassName = fund.asset_class_name || fund.asset_class || 'Unknown';
      if (!weightsByAssetClassName[assetClassName]) {
        weightsByAssetClassName[assetClassName] = weightsByAssetClass[fund.asset_class_id];
      }
    }
  });
  
  // Calculate scores and add legacy field mapping
  const scoredFunds = calculateScores(fundData, weightsByAssetClassName);
  return scoredFunds.map(fund => ({
    ...fund,
    score: fund.score_final,
    scores: {
      final: fund.score_final,
      breakdown: fund.score_breakdown
    }
  }));
}

/**
 * Main data shaping function
 * @param {Object} payload - Request payload with selection criteria
 * @returns {Object} Shaped data ready for template consumption
 */
export async function shapeReportData(payload) {
  const { asOf, selection, options } = payload;
  try { console.log('[PDF] shapeReportData received selection:', selection); } catch {}
  
  console.log(`📊 Shaping data for scope: ${selection.scope}, asOf: ${asOf || 'latest'}`);
  
  // Step 1: Resolve as-of date to EOM
  const effectiveAsOf = await resolveAsOfDate(asOf);
  console.log(`📅 Using effective as-of date: ${effectiveAsOf}`);
  
  // Step 2: Fetch funds based on selection criteria
  const funds = await fetchFunds(selection, effectiveAsOf);
  // Load full universe for stable benchmark scoring (independent of selection)
  let allFundsForAsOf = funds;
  if (selection.scope !== 'all') {
    try {
      allFundsForAsOf = await fetchFunds({ scope: 'all' }, effectiveAsOf);
      console.log(`[PDF] Loaded full universe for benchmark scoring: ${allFundsForAsOf.length} funds`);
    } catch (e) {
      console.warn('[PDF] Failed to load full universe for benchmark scoring, falling back to filtered set:', e?.message || e);
      allFundsForAsOf = funds;
    }
  }
  console.log(`💰 Retrieved ${funds.length} funds`);
  
  // Step 3: Group by asset class and resolve benchmarks (bulk-optimized)
  // For stable benchmark scoring, also pass full-universe funds for this as-of
  const sections = await buildAssetClassSections(funds, effectiveAsOf, allFundsForAsOf);
  console.log(`📈 Built ${sections.length} asset class sections`);
  
  // Step 4: Alerts summary for this as-of month (top by priority)
  const alerts = await fetchAlertsSummary(effectiveAsOf);

  return {
    asOf: effectiveAsOf,
    generatedAt: new Date().toISOString(),
    totalFunds: funds.length,
    recommendedFunds: funds.filter(f => f.is_recommended).length,
    sections,
    alerts
  };
}

/**
 * Resolve as-of date to end-of-month
 */
async function resolveAsOfDate(asOf) {
  if (asOf) {
    return toEomDate(asOf);
  }
  
  // Get latest available month from fund data
  try {
    const { data } = await supabase
      .from(TABLES.FUNDS)
      .select('as_of_month')
      .not('as_of_month', 'is', null)
      .order('as_of_month', { ascending: false })
      .limit(1);
      
    if (data && data[0]) {
      return toEomDate(data[0].as_of_month);
    }
  } catch (error) {
    console.warn('Could not resolve latest as-of date:', error);
  }
  
  // Fallback to current month end
  const now = new Date();
  return toEomDate(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`);
}

/**
 * Fetch funds based on selection criteria
 */
async function fetchFunds(selection, asOf) {
  // Prefer server-side scored dataset to ensure scores are present in PDF
  let funds = [];
  try {
    console.log('dY"< [PDF] Fetching funds with server-side scoring for asOf:', asOf);
    funds = await fundService.getAllFundsWithServerScoring(asOf);
  } catch (e) {
    console.warn('[PDF] Server-side scoring path failed:', e?.message || e);
    funds = [];
  }

  // If no scores present, fall back to base funds + runtime scoring
  const hasServerScores = Array.isArray(funds) && funds.some(f => Number.isFinite(f?.scores?.final));
  if (!hasServerScores) {
    try {
      console.log('dY"< [PDF] Falling back to base funds + runtime scoring for asOf:', asOf);
      // Load base funds using new fundDataService
      const { getFundsWithPerformance } = await import('../../services/fundDataService.js');
      const baseFunds = await getFundsWithPerformance(asOf);
      const base = baseFunds || [];
      // Use new scoring system
      funds = await applyNewScoring(base);
    } catch (err) {
      console.warn('[PDF] Runtime scoring fallback failed:', err?.message || err);
      // Last resort: keep any base funds we might have
      funds = funds && funds.length ? funds : [];
    }
  }

  console.log('dY"^ [PDF] Funds loaded:', {
    count: funds.length,
    withScores: funds.filter(f => Number.isFinite(f?.scores?.final)).length
  });
  try {
    const recCount = (funds || []).filter(f => f.is_recommended).length;
    console.log('[PDF] Initial recommendation counts:', { total: (funds || []).length, recommended: recCount });
  } catch {}
  
  // Apply selection filters
switch (selection.scope) {
    case 'recommended': {
      const before = Array.isArray(funds) ? funds.length : 0;
      const recBefore = (funds || []).filter(f => f.is_recommended).length;
      console.log('[PDF][Filter] Applying recommended-only filter. Before:', { total: before, recommended: recBefore });
      funds = (funds || []).filter(fund => fund.is_recommended);
      const after = (funds || []).length;
      console.log('[PDF][Filter] After recommended-only filter:', { total: after });
      if (after === before) {
        console.warn('[PDF][Filter] Recommended filter did not change row count. Verify is_recommended flags in dataset.');
      }
      break;
    }
    case 'tickers': {
      if (!selection.tickers || selection.tickers.length === 0) {
        throw new Error('Tickers must be provided when scope is "tickers"');
      }
      const before = Array.isArray(funds) ? funds.length : 0;
      console.log('[PDF][Filter] Applying tickers filter:', { tickers: selection.tickers, before });
      funds = (funds || []).filter(fund => selection.tickers.includes(fund.ticker));
      console.log('[PDF][Filter] After tickers filter:', { total: funds.length });
      break;
    }
    case 'all':
    default:
      console.log('[PDF][Filter] Scope=all. No filtering applied. Total:', (funds || []).length);
      break;
  }
  
  // Sort by asset class and ticker
  funds.sort((a, b) => {
    const assetCompare = (a.asset_class || '').localeCompare(b.asset_class || '');
    if (assetCompare !== 0) return assetCompare;
    return (a.ticker || '').localeCompare(b.ticker || '');
  });
  
  return funds;
}

/**
 * Fetch Alerts Summary for the selected EOM
 * Returns top alerts and basic counts (severity, asset class)
 */
async function fetchAlertsSummary(asOf) {
  try {
    // Limit: keep small for PDF readability
    const { data: rows, error } = await supabase
      .from('alerts')
      .select('id, month, ticker, asset_class, severity, priority, status, title, summary')
      .eq('month', asOf)
      .in('status', ['open','acknowledged'])
      .order('priority', { ascending: false })
      .limit(50);
    if (error) throw error;
    const topAlerts = (rows || []).map(r => ({
      id: r.id,
      month: r.month,
      ticker: r.ticker,
      assetClass: r.asset_class,
      severity: r.severity,
      priority: r.priority,
      title: r.title,
      summary: r.summary
    }));

    // Counts by severity
    const countsBySeverity = topAlerts.reduce((acc, a) => {
      acc[a.severity] = (acc[a.severity] || 0) + 1;
      return acc;
    }, {});

    // Top asset classes by alert count
    const countsByAssetClass = topAlerts.reduce((acc, a) => {
      const k = a.assetClass || 'Unclassified';
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});
    const byClassSorted = Object.entries(countsByAssetClass)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([assetClass, count]) => ({ assetClass, count }));

    return { topAlerts, countsBySeverity, topAssetClasses: byClassSorted };
  } catch (e) {
    console.warn('[PDF] Failed to load alerts summary:', e?.message || e);
    return { topAlerts: [], countsBySeverity: {}, topAssetClasses: [] };
  }
}

/**
 * Build asset class sections with benchmark data
 */
async function buildAssetClassSections(funds, asOf, allFundsForAsOf = null) {
  // Group funds by asset class
  const assetClassGroups = groupByAssetClass(funds);

  // Resolve benchmarks in bulk for performance
  const assetClassNames = Object.keys(assetClassGroups);
  const benchmarkMap = await bulkResolveBenchmarks(assetClassNames, asOf);

  // Build sections with benchmarks
  const sections = [];

  for (const [assetClass, classFunds] of Object.entries(assetClassGroups)) {
    if (classFunds.length === 0) continue;

    // Use pre-resolved benchmark for this asset class (may be null)
    const benchmark = benchmarkMap[assetClass] || null;
    
    // Sort funds by score (highest first), then by name
    const sortedFunds = classFunds.sort((a, b) => {
      const scoreA = a.scores?.final || a.score || 0;
      const scoreB = b.scores?.final || b.score || 0;
      
      if (scoreA !== scoreB) {
        return scoreB - scoreA; // Highest first
      }
      
      return (a.name || '').localeCompare(b.name || '');
    });
    
    // Optionally compute a benchmark score using the same peer set (bench excluded from stats)
    if (benchmark) {
      try {
        const benchAsFund = {
          ticker: benchmark.ticker,
          name: benchmark.name,
          asset_class: assetClass,
          asset_class_name: assetClass,
          ytd_return: benchmark.ytd_return,
          one_year_return: benchmark.one_year_return,
          three_year_return: benchmark.three_year_return,
          five_year_return: benchmark.five_year_return,
          expense_ratio: benchmark.expense_ratio,
          sharpe_ratio: benchmark.sharpe_ratio,
          standard_deviation_3y: benchmark.standard_deviation_3y,
          standard_deviation_5y: benchmark.standard_deviation_5y,
          manager_tenure: null,
          isBenchmark: true
        };
        // Compute score relative to full peer set for this asset class
        const peersFull = (allFundsForAsOf || funds || []).filter(f => {
          const cls = f.asset_class_name || f.asset_class || 'Unassigned';
          return cls === assetClass;
        });
        try { console.log('[PDF] Benchmark scoring peers for', assetClass, ':', (peersFull || []).length); } catch {}
        const scored = await applyNewScoring([...(peersFull || []), benchAsFund]);
        const benchScored = (scored || []).find(f => f.isBenchmark);
        if (benchScored?.scores?.final != null) {
          benchmark.score = benchScored.scores.final;
        }
      } catch (e) {
        console.warn('[PDF] Benchmark scoring failed:', e?.message || e);
      }
    }

    // Format fund rows
    const rows = sortedFunds.map((fund, index) => prepareFundRow(fund, index + 1, sortedFunds.length));

    // Debug: log first 3 rows' score values per section
    try {
      console.log('[PDF] Section', assetClass, 'sample scores:', rows.slice(0, 3).map(r => ({ ticker: r.ticker, score: r.score })));
    } catch {}
    
    sections.push({
      assetClass,
      fundCount: sortedFunds.length,
      recommendedCount: sortedFunds.filter(f => f.is_recommended).length,
      rows,
      benchmark
    });
  }
  
  return sections;
}

/**
 * Bulk-resolve primary benchmarks and their performance for a list of asset classes
 * Reduces round-trips by batching queries to mapping and performance tables
 */
async function bulkResolveBenchmarks(assetClassNames, asOf) {
  const result = {};
  if (!Array.isArray(assetClassNames) || assetClassNames.length === 0) return result;

  try {
    // Load asset class ids for provided names
    const { data: assetClasses } = await supabase
      .from(TABLES.ASSET_CLASSES)
      .select('id,name')
      .in('name', assetClassNames);

    const nameToId = new Map((assetClasses || []).map(ac => [ac.name, ac.id]));
    const classIds = Array.from(nameToId.values()).filter(Boolean);

    // Load benchmark mappings and pick primary (kind='primary' or rank=1)
    const { data: mappings } = await supabase
      .from(TABLES.ASSET_CLASS_BENCHMARKS)
      .select('asset_class_id,benchmark_id,kind,rank')
      .in('asset_class_id', classIds)
      .order('rank', { ascending: true });

    const primaryByClassId = new Map();
    (mappings || []).forEach(m => {
      const existing = primaryByClassId.get(m.asset_class_id);
      if (!existing || m.kind === 'primary' || m.rank === 1) {
        primaryByClassId.set(m.asset_class_id, m.benchmark_id);
      }
    });

    const benchmarkIds = Array.from(new Set(Array.from(primaryByClassId.values()).filter(Boolean)));

    // Load benchmark tickers/names
    const { data: benchmarkRows } = await supabase
      .from(TABLES.BENCHMARKS)
      .select('id,ticker,name')
      .in('id', benchmarkIds);

    const benchIdToInfo = new Map((benchmarkRows || []).map(b => [b.id, { ticker: b.ticker, name: b.name }]));

    // Build set of tickers to fetch performance for
    const tickers = Array.from(new Set((benchmarkRows || [])
      .map(b => b.ticker)
      .filter(Boolean)));

    let perfMap = {};
    if (tickers.length > 0) {
      // Get latest <= asOf for all tickers; reduce to first occurrence per ticker
      const { data: perfRows } = await supabase
        .from(TABLES.BENCHMARK_PERFORMANCE)
        .select('benchmark_ticker,date,ytd_return,one_year_return,three_year_return,five_year_return,expense_ratio,sharpe_ratio,standard_deviation_3y,standard_deviation_5y')
        .in('benchmark_ticker', tickers)
        .lte('date', asOf)
        .order('date', { ascending: false });

      perfMap = {};
      (perfRows || []).forEach(r => {
        const t = r.benchmark_ticker;
        if (!perfMap[t]) perfMap[t] = r;
      });
    }

    // Build initial result using DB mappings
    for (const [name, id] of nameToId.entries()) {
      const benchId = primaryByClassId.get(id);
      const info = benchId ? benchIdToInfo.get(benchId) : null;
      if (info && perfMap[info.ticker]) {
        result[name] = { ticker: info.ticker, name: info.name, ...perfMap[info.ticker] };
      }
    }

    // Fallback for any classes not resolved via DB mapping
    const unresolved = assetClassNames.filter(n => !result[n]);
    if (unresolved.length > 0) {
      const { getPrimaryBenchmarkSyncByLabel } = await import('../../../services/resolvers/benchmarkResolverClient.js');
      const fallbackTickers = [];
      const fallbackInfoByClass = {};
      unresolved.forEach(n => {
        const fb = getPrimaryBenchmarkSyncByLabel(n);
        if (fb?.ticker) {
          fallbackTickers.push(fb.ticker);
          fallbackInfoByClass[n] = { ticker: fb.ticker, name: fb.name || fb.ticker };
        }
      });
      if (fallbackTickers.length > 0) {
        const { data: fbPerfRows } = await supabase
          .from(TABLES.BENCHMARK_PERFORMANCE)
          .select('benchmark_ticker,date,ytd_return,one_year_return,three_year_return,five_year_return,expense_ratio,sharpe_ratio,standard_deviation_3y,standard_deviation_5y')
          .in('benchmark_ticker', Array.from(new Set(fallbackTickers)))
          .lte('date', asOf)
          .order('date', { ascending: false });

        const fbPerfMap = {};
        (fbPerfRows || []).forEach(r => { if (!fbPerfMap[r.benchmark_ticker]) fbPerfMap[r.benchmark_ticker] = r; });

        unresolved.forEach(n => {
          const info = fallbackInfoByClass[n];
          const perf = info ? fbPerfMap[info.ticker] : null;
          if (info && perf) result[n] = { ticker: info.ticker, name: info.name, ...perf };
        });
      }
    }
  } catch (e) {
    console.warn('Bulk benchmark resolution failed:', e);
  }

  return result;
}

/**
 * Group funds by asset class
 */
function groupByAssetClass(funds) {
  const groups = {};
  
  funds.forEach(fund => {
    const assetClass = fund.asset_class_name || fund.asset_class || 'Unassigned';
    if (!groups[assetClass]) {
      groups[assetClass] = [];
    }
    groups[assetClass].push(fund);
  });
  
  return groups;
}

/**
 * Resolve benchmark for an asset class
 */
async function resolveBenchmark(assetClass, asOf) {
  try {
    // Try Supabase benchmark mapping first
    const { data: assetClassData } = await supabase
      .from(TABLES.ASSET_CLASSES)
      .select('id,name')
      .eq('name', assetClass)
      .maybeSingle();
      
    if (assetClassData?.id) {
      // Get benchmark mapping
      const { data: mappings } = await supabase
        .from(TABLES.ASSET_CLASS_BENCHMARKS)
        .select('benchmark_id,kind,rank')
        .eq('asset_class_id', assetClassData.id)
        .order('rank', { ascending: true });
        
      const primaryMapping = mappings?.find(m => m.kind === 'primary') || mappings?.[0];
      
      if (primaryMapping?.benchmark_id) {
        // Get benchmark details
        const { data: benchmarkData } = await supabase
          .from(TABLES.BENCHMARKS)
          .select('ticker,name')
          .eq('id', primaryMapping.benchmark_id)
          .maybeSingle();
          
        if (benchmarkData?.ticker) {
          // Get performance data
          const performance = await getBenchmarkPerformance(benchmarkData.ticker, asOf);
          
          if (performance) {
            return {
              ticker: benchmarkData.ticker,
              name: benchmarkData.name,
              ...performance
            };
          }
        }
      }
    }
    
    // Fallback to config-based mapping
    const { getPrimaryBenchmarkSyncByLabel } = await import('../../../services/resolvers/benchmarkResolverClient.js');
    const fallbackBenchmark = getPrimaryBenchmarkSyncByLabel(assetClass);
    
    if (fallbackBenchmark?.ticker) {
      const performance = await getBenchmarkPerformance(fallbackBenchmark.ticker, asOf);
      
      if (performance) {
        return {
          ticker: fallbackBenchmark.ticker,
          name: fallbackBenchmark.name || fallbackBenchmark.ticker,
          ...performance
        };
      }
    }
    
    return null;
    
  } catch (error) {
    console.warn(`Failed to resolve benchmark for ${assetClass}:`, error);
    return null;
  }
}

/**
 * Get benchmark performance data
 */
async function getBenchmarkPerformance(ticker, asOf) {
  try {
    // Try exact date match first
    let { data } = await supabase
      .from(TABLES.BENCHMARK_PERFORMANCE)
      .select('ytd_return,one_year_return,three_year_return,five_year_return,expense_ratio,sharpe_ratio,standard_deviation_3y,standard_deviation_5y')
      .eq('benchmark_ticker', ticker)
      .eq('date', asOf)
      .maybeSingle();
      
    // If no exact match, get latest <= asOf
    if (!data) {
      const { data: latestData } = await supabase
        .from(TABLES.BENCHMARK_PERFORMANCE)
        .select('ytd_return,one_year_return,three_year_return,five_year_return,expense_ratio,sharpe_ratio,standard_deviation_3y,standard_deviation_5y')
        .eq('benchmark_ticker', ticker)
        .lte('date', asOf)
        .order('date', { ascending: false })
        .limit(1);
        
      data = latestData?.[0];
    }
    
    return data;
    
  } catch (error) {
    console.warn(`Failed to get performance for ${ticker}:`, error);
    return null;
  }
}

/**
 * Prepare a formatted fund row
 */
function prepareFundRow(fund, rank, totalInClass) {
  return {
    ticker: fund.ticker || '',
    name: fund.name || '',
    assetClass: fund.asset_class_name || fund.asset_class || 'Unassigned',
    ytdReturn: formatPercentDisplay(fund.ytd_return),
    oneYearReturn: formatPercentDisplay(fund.one_year_return),
    threeYearReturn: formatPercentDisplay(fund.three_year_return),
    fiveYearReturn: formatPercentDisplay(fund.five_year_return),
    sharpeRatio: formatNumberDisplay(fund.sharpe_ratio, 2),
    standardDeviation3y: formatPercentDisplay(fund.standard_deviation_3y),
    standardDeviation5y: formatPercentDisplay(fund.standard_deviation_5y),
    expenseRatio: formatPercentDisplay(fund.expense_ratio),
    managerTenure: formatTenure(fund.manager_tenure),
    score: formatNumberDisplay(fund.scores?.final || fund.score, 1),
    isRecommended: fund.is_recommended,
    raw: fund // Keep raw data for any custom formatting needs
  };
}

/**
 * Format manager tenure
 */
function formatTenure(value) {
  if (value === null || value === undefined || isNaN(value)) {
    return 'N/A';
  }
  
  const years = Math.floor(value);
  const months = Math.round((value - years) * 12);
  
  if (years === 0) {
    return `${months}m`;
  } else if (months === 0) {
    return `${years}y`;
  } else {
    return `${years}y ${months}m`;
  }
}

// ES6 export is at function definition
