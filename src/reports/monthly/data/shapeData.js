/**
 * Data Shaping Service for Monthly PDF Reports
 * Fetches and normalizes fund data, resolves benchmarks, and structures for template consumption
 */

import { supabase, TABLES } from '../../../services/supabase.js';
import { formatPercentDisplay, formatNumberDisplay, toEomDate } from '../shared/format.js';

/**
 * Main data shaping function
 * @param {Object} payload - Request payload with selection criteria
 * @returns {Object} Shaped data ready for template consumption
 */
export async function shapeReportData(payload) {
  const { asOf, selection, options } = payload;
  
  console.log(`📊 Shaping data for scope: ${selection.scope}, asOf: ${asOf || 'latest'}`);
  
  // Step 1: Resolve as-of date to EOM
  const effectiveAsOf = await resolveAsOfDate(asOf);
  console.log(`📅 Using effective as-of date: ${effectiveAsOf}`);
  
  // Step 2: Fetch funds based on selection criteria
  const funds = await fetchFunds(selection, effectiveAsOf);
  console.log(`💰 Retrieved ${funds.length} funds`);
  
  // Step 3: Group by asset class and resolve benchmarks
  const sections = await buildAssetClassSections(funds, effectiveAsOf);
  console.log(`📈 Built ${sections.length} asset class sections`);
  
  return {
    asOf: effectiveAsOf,
    generatedAt: new Date().toISOString(),
    totalFunds: funds.length,
    recommendedFunds: funds.filter(f => f.is_recommended).length,
    sections
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
  let query = supabase
    .from(TABLES.FUNDS)
    .select(`
      ticker,
      name,
      asset_class,
      asset_class_name,
      ytd_return,
      one_year_return,
      three_year_return,
      five_year_return,
      expense_ratio,
      sharpe_ratio,
      standard_deviation_3y,
      standard_deviation_5y,
      manager_tenure,
      is_recommended,
      score,
      scores
    `);
  
  // Apply selection filters
  switch (selection.scope) {
    case 'recommended':
      query = query.eq('is_recommended', true);
      break;
      
    case 'tickers':
      if (!selection.tickers || selection.tickers.length === 0) {
        throw new Error('Tickers must be provided when scope is "tickers"');
      }
      query = query.in('ticker', selection.tickers);
      break;
      
    case 'all':
    default:
      // No additional filtering
      break;
  }
  
  // Add as-of month filter if available
  const { data, error } = await query
    .order('asset_class')
    .order('ticker');
  
  if (error) {
    throw new Error(`Failed to fetch funds: ${error.message}`);
  }
  
  return data || [];
}

/**
 * Build asset class sections with benchmark data
 */
async function buildAssetClassSections(funds, asOf) {
  // Group funds by asset class
  const assetClassGroups = groupByAssetClass(funds);
  
  // Build sections with benchmarks
  const sections = [];
  
  for (const [assetClass, classFunds] of Object.entries(assetClassGroups)) {
    if (classFunds.length === 0) continue;
    
    // Resolve benchmark for this asset class
    const benchmark = await resolveBenchmark(assetClass, asOf);
    
    // Sort funds by score (highest first), then by name
    const sortedFunds = classFunds.sort((a, b) => {
      const scoreA = a.scores?.final || a.score || 0;
      const scoreB = b.scores?.final || b.score || 0;
      
      if (scoreA !== scoreB) {
        return scoreB - scoreA; // Highest first
      }
      
      return (a.name || '').localeCompare(b.name || '');
    });
    
    // Format fund rows
    const rows = sortedFunds.map((fund, index) => prepareFundRow(fund, index + 1, sortedFunds.length));
    
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
    expenseRatio: formatPercentDisplay(fund.expense_ratio),
    sharpeRatio: formatNumberDisplay(fund.sharpe_ratio, 2),
    standardDeviation3y: formatPercentDisplay(fund.standard_deviation_3y),
    standardDeviation5y: formatPercentDisplay(fund.standard_deviation_5y),
    managerTenure: formatTenure(fund.manager_tenure),
    score: formatNumberDisplay(fund.scores?.final || fund.score, 1),
    rank: `${rank}/${totalInClass}`,
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