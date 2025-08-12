// src/hooks/useFundData.js
import { useState, useEffect, useCallback, useMemo } from 'react';
import fundService from '../services/fundService';
import asOfStore from '../services/asOfStore';
import ychartsAPI from '../services/ychartsAPI';
import { computeRuntimeScores, loadEffectiveWeightsResolver } from '../services/scoring';

export function useFundData() {
  const [funds, setFunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [asOfMonth, setAsOfMonth] = useState(null); // YYYY-MM-DD or null for latest
  const [activeMonthCounts, setActiveMonthCounts] = useState({ fund: null, bench: null });
  // Feature flag: runtime scoring for live as-of month data
  const ENABLE_RUNTIME_SCORING = (process.env.REACT_APP_ENABLE_RUNTIME_SCORING || 'false') === 'true';
  const ENABLE_REFRESH = (process.env.REACT_APP_ENABLE_REFRESH || 'false') === 'true';

  // Load funds from database
  const loadFunds = useCallback(async (asOf = asOfMonth) => {
    try {
      setLoading(true);
      setError(null);
      
      // Ensure we have a validated active month from store
      if (!asOf) {
        const res = await asOfStore.syncWithDb();
        asOf = res?.active || null;
        setAsOfMonth(asOf);
      }
      const fundData = await fundService.getAllFunds(asOf);
      // Load effective weights once per refresh (resolver caches in module)
      if (ENABLE_RUNTIME_SCORING) {
        await loadEffectiveWeightsResolver();
      }
      const enriched = ENABLE_RUNTIME_SCORING ? computeRuntimeScores(fundData) : fundData;
      setFunds(enriched);
      setLastUpdated(new Date());
      
      console.log(`Loaded ${fundData.length} funds from database${asOf ? ` as of ${asOf}` : ''}${ENABLE_RUNTIME_SCORING ? ' (runtime scoring enabled)' : ''}`);
      // Count rows for guardrails
      try {
        const d = asOf || asOfStore.getActiveMonth();
        if (d) {
          const [{ data: fRows }, { data: bRows }] = await Promise.all([
            fundService.supabase?.from?.(fundService.TABLES?.FUND_PERFORMANCE || 'fund_performance')?.select?.('fund_ticker')?.eq?.('date', d) ?? Promise.resolve({ data: [] }),
            fundService.supabase?.from?.(fundService.TABLES?.BENCHMARK_PERFORMANCE || 'benchmark_performance')?.select?.('benchmark_ticker')?.eq?.('date', d) ?? Promise.resolve({ data: [] })
          ]);
          setActiveMonthCounts({ fund: (fRows || []).length, bench: (bRows || []).length });
        }
      } catch {}
    } catch (error) {
      console.error('Failed to load funds:', error);
      setError('Failed to load funds from database');
    } finally {
      setLoading(false);
    }
  }, [asOfMonth, ENABLE_RUNTIME_SCORING]);

  // Recompute runtime scores when asOfMonth or fetched funds change if flag is ON
  useEffect(() => {
    if (!ENABLE_RUNTIME_SCORING) return;
    if (!Array.isArray(funds) || funds.length === 0) return;
    try {
      const rescored = computeRuntimeScores(funds);
      setFunds(rescored);
    } catch (e) {
      // no-op: don't break UI on scoring issues
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asOfMonth, funds.length, ENABLE_RUNTIME_SCORING]);

  // Refresh data from Ycharts API
  const refreshData = useCallback(async (tickers = null) => {
    try {
      if (!ENABLE_REFRESH) {
        // Block writes and snapshot creation in production
        console.warn('Refresh is disabled in production');
        setError('Refresh is disabled in production');
        return;
      }
      setIsUpdating(true);
      setError(null);

      const normalizeSymbol = (s) => (s == null ? '' : String(s).toUpperCase().trim());
      let fundsToUpdate = Array.isArray(funds) ? funds : [];

      // Defensive selection logic: accept arrays, strings (search), or filter objects
      if (tickers != null) {
        // Case 1: Array of tickers
        if (Array.isArray(tickers)) {
          const want = new Set(tickers.filter(Boolean).map(normalizeSymbol));
          if (want.size > 0) {
            fundsToUpdate = fundsToUpdate.filter((fund) => want.has(normalizeSymbol(fund.ticker)));
          }
        }
        // Case 2: String query -> match ticker/name/asset class
        else if (typeof tickers === 'string') {
          const q = tickers.trim();
          if (q.length > 0) {
            const qLower = q.toLowerCase();
            fundsToUpdate = fundsToUpdate.filter((fund) => {
              const t = String(fund.ticker || fund.symbol || '').toLowerCase();
              const n = String(fund.name || fund.displayName || '').toLowerCase();
              const ac = String(fund.asset_class_name || fund.asset_class || '').toLowerCase();
              return t.includes(qLower) || n.includes(qLower) || ac.includes(qLower);
            });
          }
        }
        // Case 3: Object with common filter fields
        else if (typeof tickers === 'object') {
          const selected = Array.isArray(tickers.selectedTickers) ? tickers.selectedTickers.map(normalizeSymbol) : [];
          const assetClass = typeof tickers.assetClass === 'string' ? tickers.assetClass.trim().toLowerCase() : '';
          const search = typeof tickers.search === 'string' ? tickers.search.trim().toLowerCase() : '';

          fundsToUpdate = fundsToUpdate.filter((fund) => {
            const t = normalizeSymbol(fund.ticker);
            const n = String(fund.name || fund.displayName || '').toLowerCase();
            const ac = String(fund.asset_class_name || fund.asset_class || '').toLowerCase();
            const matchesSelected = selected.length > 0 ? selected.includes(t) : true;
            const matchesClass = assetClass ? ac === assetClass : true;
            const matchesSearch = search ? (t.toLowerCase().includes(search) || n.includes(search) || ac.includes(search)) : true;
            return matchesSelected && matchesClass && matchesSearch;
          });
        }
      }

      if (fundsToUpdate.length === 0) {
        console.log('No funds to update');
        return;
      }

      console.log(`Updating ${fundsToUpdate.length} funds from Ycharts API...`);

      const updateResults = await fundService.batchUpdateFromAPI(
        fundsToUpdate.map(fund => fund.ticker)
      );

      // Count successful updates
      const successfulUpdates = updateResults.filter(result => result.success).length;
      const failedUpdates = updateResults.filter(result => !result.success);

      if (failedUpdates.length > 0) {
        console.warn('Some fund updates failed:', failedUpdates);
      }

      // Reload funds from database to get updated data
      await loadFunds();

      console.log(`Successfully updated ${successfulUpdates} funds`);
      
      if (failedUpdates.length > 0) {
        setError(`${successfulUpdates} funds updated successfully. ${failedUpdates.length} updates failed.`);
      }
    } catch (error) {
      console.error('Failed to refresh fund data:', error);
      setError('Failed to refresh fund data from API');
    } finally {
      setIsUpdating(false);
    }
  }, [funds, loadFunds, ENABLE_REFRESH]);

  // Add new fund
  const addFund = useCallback(async (ticker, assetClass = null) => {
    try {
      setError(null);
      
      // Check if fund already exists
      const existingFund = funds.find(fund => fund.ticker === ticker.toUpperCase());
      if (existingFund) {
        setError(`Fund ${ticker} already exists`);
        return false;
      }

      // Fetch fund data from Ycharts API
      const apiData = await ychartsAPI.getFundData(ticker);
      if (!apiData) {
        setError(`Could not find fund data for ${ticker}`);
        return false;
      }

      // Handle both direct data and wrapped data structure
      const fundInfo = apiData.data || apiData;
      
      // Save fund to database
      const fundData = {
        ticker: ticker.toUpperCase(),
        name: fundInfo.name || `${ticker} Fund`,
        asset_class: assetClass || fundInfo.asset_class || 'Unassigned',
        asset_class_id: fundInfo.asset_class_id || null,
        is_recommended: false
      };

      await fundService.saveFund(fundData);

      // Save performance data
      const performanceData = {
        ticker: ticker.toUpperCase(),
        date: new Date(),
        ytd_return: fundInfo.ytd_return || null,
        one_year_return: fundInfo.one_year_return || null,
        three_year_return: fundInfo.three_year_return || null,
        five_year_return: fundInfo.five_year_return || null,
        ten_year_return: fundInfo.ten_year_return || null,
        sharpe_ratio: fundInfo.sharpe_ratio || null,
        standard_deviation: fundInfo.standard_deviation || null,
        expense_ratio: fundInfo.expense_ratio || null,
        alpha: fundInfo.alpha || null,
        beta: fundInfo.beta || null,
        manager_tenure: fundInfo.manager_tenure || null,
        // NEW FIELDS - Capture ratios and additional data
        up_capture_ratio: fundInfo.up_capture_ratio || null,
        down_capture_ratio: fundInfo.down_capture_ratio || null,
        category_rank: fundInfo.category_rank || null,
        sec_yield: fundInfo.sec_yield || null,
        fund_family: fundInfo.fund_family || null
      };

      await fundService.saveFundPerformance(performanceData);

      // Reload funds
      await loadFunds();

      console.log(`Successfully added fund ${ticker}`);
      return true;
    } catch (error) {
      console.error(`Failed to add fund ${ticker}:`, error);
      setError(`Failed to add fund ${ticker}: ${error.message}`);
      return false;
    }
  }, [funds, loadFunds]);

  // Remove fund
  const removeFund = useCallback(async (ticker) => {
    try {
      setError(null);
      
      await fundService.deleteFund(ticker);
      await loadFunds();
      
      console.log(`Successfully removed fund ${ticker}`);
      return true;
    } catch (error) {
      console.error(`Failed to remove fund ${ticker}:`, error);
      setError(`Failed to remove fund ${ticker}: ${error.message}`);
      return false;
    }
  }, [loadFunds]);

  // Update fund recommendation status
  const updateFundRecommendation = useCallback(async (ticker, isRecommended) => {
    try {
      setError(null);
      
      const fund = funds.find(f => f.ticker === ticker);
      if (!fund) {
        setError(`Fund ${ticker} not found`);
        return false;
      }

      const updatedFund = { ...fund, is_recommended: isRecommended };
      await fundService.saveFund(updatedFund);
      await loadFunds();
      
      console.log(`Updated recommendation status for ${ticker} to ${isRecommended}`);
      return true;
    } catch (error) {
      console.error(`Failed to update recommendation for ${ticker}:`, error);
      setError(`Failed to update recommendation for ${ticker}: ${error.message}`);
      return false;
    }
  }, [funds, loadFunds]);

  // Search funds
  const searchFunds = useCallback(async (query) => {
    try {
      if (!query.trim()) {
        return funds;
      }

      const searchResults = await fundService.searchFunds(query);
      return searchResults;
    } catch (error) {
      console.error('Failed to search funds:', error);
      return [];
    }
  }, [funds]);

  // Get funds by asset class
  const getFundsByAssetClass = useCallback((assetClass) => {
    if (assetClass === 'all') {
      return funds;
    }
    return funds.filter(fund => fund.asset_class === assetClass);
  }, [funds]);

  // Get recommended funds
  const getRecommendedFunds = useCallback(() => {
    return funds.filter(fund => fund.is_recommended);
  }, [funds]);

  // Auto-refresh data (hourly)
  useEffect(() => {
    const interval = setInterval(() => {
      if (funds.length > 0) {
        console.log('Auto-refreshing fund data...');
        refreshData();
      }
    }, 60 * 60 * 1000); // 1 hour

    return () => clearInterval(interval);
  }, [funds.length, refreshData]);

  // Load funds on mount (and sync as-of with DB)
  useEffect(() => {
    (async () => {
      await asOfStore.syncWithDb();
      setAsOfMonth(asOfStore.getActiveMonth());
      await loadFunds(asOfStore.getActiveMonth());
    })();
  }, [loadFunds]);

  // Reload funds when asOfMonth changes
  useEffect(() => {
    // Skip initial double-trigger; loadFunds already ran on mount
    if (asOfMonth !== undefined) {
      loadFunds(asOfMonth);
    }
  }, [asOfMonth, loadFunds]);

  // External setter should update store too
  const setAsOfMonthAndStore = useCallback((m) => {
    asOfStore.setActiveMonth(m);
    setAsOfMonth(m);
  }, []);

  // Memoized computed values
  const assetClasses = useMemo(() => {
    const classes = new Set(funds.map(fund => fund.asset_class).filter(Boolean));
    return Array.from(classes).sort();
  }, [funds]);

  const fundCount = useMemo(() => funds.length, [funds]);
  const recommendedCount = useMemo(() => funds.filter(fund => fund.is_recommended).length, [funds]);

  return {
    // State
    funds,
    loading,
    error,
    lastUpdated,
    isUpdating,
    asOfMonth,
    
    // Actions
    loadFunds,
    refreshData,
    addFund,
    removeFund,
    updateFundRecommendation,
    searchFunds,
    setAsOfMonth: setAsOfMonthAndStore,
    
    // Computed values
    assetClasses,
    fundCount,
    recommendedCount,
    getFundsByAssetClass,
    getRecommendedFunds
  };
} 