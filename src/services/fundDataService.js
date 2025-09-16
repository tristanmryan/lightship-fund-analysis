// src/services/fundDataService.js
import { supabase, TABLES, dbUtils, handleSupabaseError } from './supabase.js';

/**
 * Consolidated Fund Data Service
 * 
 * This service consolidates fund data loading with proper database joins,
 * replacing the complex resolver logic spread across multiple files.
 * 
 * It provides a single, clean interface for loading funds with their
 * associated performance data and asset class information.
 */

/**
 * Get funds with performance data using proper database joins
 * 
 * @param {string|null} asOfDate - Date string in YYYY-MM-DD format, or null for latest
 * @param {string|null} assetClassId - Optional asset class ID to filter by
 * @returns {Promise<Array>} Array of flattened fund objects with all data
 */
export async function getFundsWithPerformance(asOfDate = null, assetClassId = null) {
  try {
    // Validate and format the date parameter
    const dateOnly = asOfDate ? dbUtils.formatDateOnly(asOfDate) : null;
    
    // Due to Supabase PostgREST limitations with complex joins, we'll use a two-step approach
    // Step 1: Get funds with basic info and optional asset class filtering
    let fundsQuery = supabase
      .from(TABLES.FUNDS)
      .select(`
        ticker,
        name,
        asset_class,
        asset_class_id,
        is_recommended,
        added_date,
        removed_date,
        notes,
        last_updated,
        created_at
      `);

    // Add asset class filtering if specified
    if (assetClassId) {
      fundsQuery = fundsQuery.eq('asset_class_id', assetClassId);
    }

    // Order funds consistently
    fundsQuery = fundsQuery.order('ticker', { ascending: true });

    const { data: funds, error: fundsError } = await fundsQuery;

    if (fundsError) {
      throw new Error(`Error fetching funds: ${fundsError.message}`);
    }

    if (!funds || funds.length === 0) {
      console.warn(`No funds found for asset class: ${assetClassId || 'all'}`);
      return [];
    }

    // Determine the target date for performance data
    let targetDate = dateOnly;
    if (!targetDate) {
      // Get the most recent date available
      const { data: latestDates, error: dateError } = await supabase
        .from(TABLES.FUND_PERFORMANCE)
        .select('date')
        .order('date', { ascending: false })
        .limit(1);
      
      if (dateError) {
        throw new Error(`Error fetching latest date: ${dateError.message}`);
      }
      
      if (latestDates && latestDates.length > 0) {
        targetDate = latestDates[0].date;
      } else {
        console.warn('No performance data found in database');
        return [];
      }
    }

    // Step 2: Get performance data for the funds at the target date
    const fundTickers = funds.map(f => f.ticker);
    let { data: performanceData, error: perfError } = await supabase
      .from(TABLES.FUND_PERFORMANCE)
      .select(`
        fund_ticker,
        date,
        ytd_return,
        one_year_return,
        three_year_return,
        five_year_return,
        ten_year_return,
        sharpe_ratio,
        standard_deviation,
        standard_deviation_3y,
        standard_deviation_5y,
        expense_ratio,
        alpha,
        beta,
        manager_tenure,
        up_capture_ratio,
        down_capture_ratio,
        category_rank,
        sec_yield,
        fund_family,
        created_at
      `)
      .in('fund_ticker', fundTickers)
      .eq('date', targetDate);

    if (perfError) {
      throw new Error(`Error fetching performance data: ${perfError.message}`);
    }

    // Fallback: if no performance rows for the requested date, use the latest date <= targetDate
    if ((!performanceData || performanceData.length === 0) && targetDate) {
      const { data: fallbackDateRows, error: fallbackErr } = await supabase
        .from(TABLES.FUND_PERFORMANCE)
        .select('date')
        .lte('date', targetDate)
        .order('date', { ascending: false })
        .limit(1);
      if (!fallbackErr && Array.isArray(fallbackDateRows) && fallbackDateRows.length > 0) {
        const fallbackDate = fallbackDateRows[0].date;
        const resp = await supabase
          .from(TABLES.FUND_PERFORMANCE)
          .select(`
            fund_ticker,
            date,
            ytd_return,
            one_year_return,
            three_year_return,
            five_year_return,
            ten_year_return,
            sharpe_ratio,
            standard_deviation,
            standard_deviation_3y,
            standard_deviation_5y,
            expense_ratio,
            alpha,
            beta,
            manager_tenure,
            up_capture_ratio,
            down_capture_ratio,
            category_rank,
            sec_yield,
            fund_family,
            created_at
          `)
          .in('fund_ticker', fundTickers)
          .eq('date', fallbackDate);
        if (!resp.error) {
          performanceData = resp.data || [];
          targetDate = fallbackDate;
          // eslint-disable-next-line no-console
          console.log('[FundsPerfFallback] Using nearest performance date <= requested', { requested: asOfDate, targetDate });
        }
      }
    }

    // Step 3: Get asset class data if any funds have asset_class_id
    const assetClassIds = funds
      .map(f => f.asset_class_id)
      .filter(id => id !== null && id !== undefined);
    
    let assetClassesMap = new Map();
    if (assetClassIds.length > 0) {
      const { data: assetClasses, error: acError } = await supabase
        .from(TABLES.ASSET_CLASSES)
        .select(`
          id,
          code,
          name,
          description,
          group_name,
          sort_group,
          sort_order
        `)
        .in('id', assetClassIds);

      if (!acError && assetClasses) {
        assetClasses.forEach(ac => assetClassesMap.set(ac.id, ac));
      }
    }

    // Create performance lookup map
    const performanceMap = new Map();
    if (performanceData) {
      performanceData.forEach(perf => {
        performanceMap.set(perf.fund_ticker, perf);
      });
    }

    // Step 4: Combine all data and create flattened results
    const results = funds.map(fund => {
      const assetClass = assetClassesMap.get(fund.asset_class_id);
      const performance = performanceMap.get(fund.ticker);

      // Only include funds that have performance data for the target date
      if (!performance) {
        return null; // Will be filtered out
      }
      
      return {
        // Fund basic info
        ticker: fund.ticker,
        symbol: fund.ticker, // Alias for compatibility
        name: fund.name,
        is_recommended: !!fund.is_recommended,
        recommended: !!fund.is_recommended, // Alias for compatibility
        added_date: fund.added_date,
        removed_date: fund.removed_date,
        notes: fund.notes,
        last_updated: fund.last_updated,
        created_at: fund.created_at,

        // Asset class information (flattened)
        asset_class: fund.asset_class, // Legacy string field
        asset_class_id: fund.asset_class_id,
        asset_class_code: assetClass?.code || null,
        asset_class_name: assetClass?.name || fund.asset_class || null,
        asset_class_description: assetClass?.description || null,
        asset_group_name: assetClass?.group_name || null,
        asset_group_sort: assetClass?.sort_group || null,
        asset_class_sort: assetClass?.sort_order || null,

        // Performance data (flattened)
        date: performance.date,
        ytd_return: performance.ytd_return,
        one_year_return: performance.one_year_return,
        three_year_return: performance.three_year_return,
        five_year_return: performance.five_year_return,
        ten_year_return: performance.ten_year_return,
        sharpe_ratio: performance.sharpe_ratio,
        standard_deviation: performance.standard_deviation,
        standard_deviation_3y: performance.standard_deviation_3y,
        standard_deviation_5y: performance.standard_deviation_5y,
        expense_ratio: performance.expense_ratio,
        alpha: performance.alpha,
        beta: performance.beta,
        manager_tenure: performance.manager_tenure,
        up_capture_ratio: performance.up_capture_ratio,
        down_capture_ratio: performance.down_capture_ratio,
        category_rank: performance.category_rank,
        sec_yield: performance.sec_yield,
        fund_family: performance.fund_family,

        // Compatibility aliases for legacy components
        three_year_sharpe: performance.sharpe_ratio,
        three_year_std_dev: performance.standard_deviation_3y,

        // Performance date
        perf_date: performance.date,
        performance_created_at: performance.created_at
      };
    }).filter(Boolean); // Remove null entries

    console.log(`Successfully loaded ${results.length} funds with performance data for date: ${targetDate}`);
    return results;

  } catch (error) {
    // Comprehensive error handling
    const errorMessage = `Error fetching funds with performance: ${error.message}`;
    console.error(errorMessage, {
      asOfDate,
      assetClassId,
      originalError: error
    });

    // Re-throw with context for upstream handling
    const contextualError = new Error(errorMessage);
    contextualError.originalError = error;
    contextualError.context = { asOfDate, assetClassId };
    
    handleSupabaseError(contextualError, 'getFundsWithPerformance');
    
    // Return empty array as fallback to prevent UI crashes
    return [];
  }
}

/**
 * Alternative implementation using RPC for better performance
 * This could replace the above if we create a dedicated stored procedure
 */
export async function getFundsWithPerformanceRPC(asOfDate = null, assetClassId = null) {
  try {
    const dateOnly = asOfDate ? dbUtils.formatDateOnly(asOfDate) : null;
    
    const { data, error } = await supabase.rpc('get_funds_with_performance', {
      p_date: dateOnly,
      p_asset_class_id: assetClassId
    });

    if (error) {
      throw new Error(`RPC call failed: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error('Error in RPC-based fund data fetch:', error);
    
    // Fallback to the standard implementation
    console.warn('Falling back to standard implementation...');
    return getFundsWithPerformance(asOfDate, assetClassId);
  }
}

// Default export - the main function
export default getFundsWithPerformance;

/**
 * Utility function to get available dates for fund performance data
 */
export async function getAvailablePerformanceDates() {
  try {
    const { data, error } = await supabase
      .from(TABLES.FUND_PERFORMANCE)
      .select('date')
      .order('date', { ascending: false });

    if (error) throw error;

    if (!data || !Array.isArray(data)) {
      console.warn('No performance dates data returned');
      return [];
    }

    // Return unique dates
    const uniqueDates = [...new Set(data.map(row => row.date))];
    return uniqueDates;
  } catch (error) {
    console.error('Error fetching available performance dates:', error);
    return [];
  }
}

/**
 * Utility function to get asset class options for filtering
 */
export async function getAssetClassOptions() {
  try {
    const { data, error } = await supabase
      .from(TABLES.ASSET_CLASSES)
      .select('id, code, name, group_name')
      .order('sort_group', { ascending: true })
      .order('sort_order', { ascending: true });

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Error fetching asset class options:', error);
    return [];
  }
}