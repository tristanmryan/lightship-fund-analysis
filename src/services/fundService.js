// src/services/fundService.js
import { supabase, TABLES, dbUtils, handleSupabaseError, toNumberStrict } from './supabase.js';
import ychartsAPI from './ychartsAPI.js';

class FundService {
  constructor() { this._ownershipCache = new Map(); this._fundsWithOwnershipCache = new Map(); }


  // expose supabase and TABLES for limited use in hooks/tests
  get supabase() { return supabase; }
  get TABLES() { return TABLES; }

  // Feature flag for server-side scoring
  get useServerScoring() {
    return (process.env.REACT_APP_DB_SCORES || 'false') === 'true';
  }

  // Get all funds from database with performance at a given date (or latest if null)
  async getAllFunds(asOfDate = null) {
    try {
      // Use new fundDataService instead of deleted get_funds_as_of RPC
      const { getFundsWithPerformance } = await import('./fundDataService.js');
      const rows = await getFundsWithPerformance(asOfDate);

      // Enrich with asset_classes in one pass (optional; keep resilient if table empty)
      const classMap = new Map();
      try {
        const { data: classes } = await supabase
          .from(TABLES.ASSET_CLASSES)
          .select('id, code, name, group_name, sort_group, sort_order');
        (classes || []).forEach(ac => classMap.set(ac.id, ac));
      } catch {}

      return (rows || []).map((r) => {
        const ac = r.asset_class_id ? classMap.get(r.asset_class_id) : null;
        return {
          ticker: r.ticker,
          symbol: r.ticker,
          name: r.name,
          asset_class: r.asset_class,
          asset_class_id: r.asset_class_id || null,
          asset_class_code: ac?.code || null,
          asset_class_name: ac?.name || r.asset_class || null,
          asset_group_name: ac?.group_name || null,
          asset_group_sort: ac?.sort_group || null,
          asset_class_sort: ac?.sort_order || null,
          is_recommended: !!r.is_recommended,
          ytd_return: r.ytd_return,
          one_year_return: r.one_year_return,
          three_year_return: r.three_year_return,
          five_year_return: r.five_year_return,
          ten_year_return: r.ten_year_return,
          sharpe_ratio: r.sharpe_ratio,
          standard_deviation: r.standard_deviation,
          standard_deviation_3y: r.standard_deviation_3y,
          standard_deviation_5y: r.standard_deviation_5y,
          expense_ratio: r.expense_ratio,
          alpha: r.alpha,
          beta: r.beta,
          manager_tenure: r.manager_tenure,
          up_capture_ratio: r.up_capture_ratio,
          down_capture_ratio: r.down_capture_ratio,
          category_rank: r.category_rank,
          sec_yield: r.sec_yield,
          fund_family: r.fund_family,
          date: r.perf_date
        };
      });
    } catch (error) {
      handleSupabaseError(error, 'getAllFunds');
      return [];
    }
  }

  // Get funds with server-side scoring when enabled
  async getAllFundsWithScoring(asOfDate = null) {
    if (this.useServerScoring) {
      return this.getAllFundsWithServerScoring(asOfDate);
    } else {
      return this.getAllFunds(asOfDate);
    }
  }

  // Get funds with server-side scoring via RPC (merge scores from asset class table)
  async getAllFundsWithServerScoring(asOfDate = null) {
    try {
      const asOf = asOfDate ? new Date(asOfDate + 'T00:00:00Z') : null;
      const dateOnly = asOf ? asOf.toISOString().slice(0, 10) : null;

      // Use new fundDataService instead of deleted calculate_scores_as_of RPC
      const { getFundsWithPerformance } = await import('./fundDataService.js');
      const baseFunds = await getFundsWithPerformance(asOfDate);
      
      // No server-side scoring available - return base funds for client-side scoring
      const scoredFunds = baseFunds;

      // Enrich with asset class metadata for compatibility
      const classMap = new Map();
      try {
        const { data: classes } = await supabase
          .from(TABLES.ASSET_CLASSES)
          .select('id, code, name, group_name, sort_group, sort_order');
        (classes || []).forEach(ac => classMap.set(ac.id, ac));
      } catch {}

      // Optionally fetch performance metrics if missing on scored rows
      let perfMap = new Map();
      const needsPerf = Array.isArray(scoredFunds) && scoredFunds.length > 0
        ? !('ytd_return' in (scoredFunds[0] || {}))
        : false;
      if (needsPerf) {
        // Use new fundDataService instead of deleted RPC
        const { getFundsWithPerformance } = await import('./fundDataService.js');
        const perfData = await getFundsWithPerformance(dateOnly);
        perfMap = new Map((perfData || []).map(f => [f.ticker, f]));
      }

      // Ownership summary
      const ownMap = await this.getOwnershipSummary(asOfDate);

      return (scoredFunds || []).map(fund => {
        const perf = perfMap.get(fund.ticker) || {};
        const metricsUsed = Number(fund.metrics_used || 0);
        const totalPossible = Number(fund.total_possible_metrics || 0);
        const confidence = (metricsUsed && totalPossible)
          ? Math.round((metricsUsed / totalPossible) * 100)
          : 0;
        const own = ownMap.get(fund.ticker) || {};

        const ac = (fund.asset_class_id && classMap.has(fund.asset_class_id)) ? classMap.get(fund.asset_class_id) : null;
        return {
          ticker: fund.ticker,
          name: fund.name,
          asset_class_id: fund.asset_class_id || perf.asset_class_id || null,
          asset_class_name: ac?.name || null,
          asset_class_code: ac?.code || null,
          asset_group_name: ac?.group_name || null,
          asset_group_sort: ac?.sort_group || null,
          asset_class_sort: ac?.sort_order || null,
          is_benchmark: !!fund.is_benchmark,
          is_recommended: !!fund.is_recommended,

          // Performance fields
          ytd_return: fund.ytd_return ?? perf.ytd_return,
          one_year_return: fund.one_year_return ?? perf.one_year_return,
          three_year_return: fund.three_year_return ?? perf.three_year_return,
          five_year_return: fund.five_year_return ?? perf.five_year_return,
          ten_year_return: fund.ten_year_return ?? perf.ten_year_return,
          sharpe_ratio: fund.sharpe_ratio ?? perf.sharpe_ratio,
          standard_deviation: fund.standard_deviation ?? perf.standard_deviation,
          standard_deviation_3y: fund.standard_deviation_3y ?? perf.standard_deviation_3y,
          standard_deviation_5y: fund.standard_deviation_5y ?? perf.standard_deviation_5y,
          expense_ratio: fund.expense_ratio ?? perf.expense_ratio,
          alpha: fund.alpha ?? perf.alpha,
          beta: fund.beta ?? perf.beta,
          manager_tenure: fund.manager_tenure ?? perf.manager_tenure,
          up_capture_ratio: fund.up_capture_ratio ?? perf.up_capture_ratio,
          down_capture_ratio: fund.down_capture_ratio ?? perf.down_capture_ratio,
          category_rank: fund.category_rank ?? perf.category_rank,
          sec_yield: fund.sec_yield ?? perf.sec_yield,
          fund_family: fund.fund_family ?? perf.fund_family,
          date: fund.perf_date ?? perf.perf_date,

          // Scores
          score: Number(fund.score_final || 0),
          score_final: Number(fund.score_final || 0),
          score_raw: Number(fund.score_raw || 0),
          percentile: Number(fund.percentile || 0),

          scores: {
            final: Number(fund.score_final || 0),
            raw: Number(fund.score_raw || 0),
            percentile: Number(fund.percentile || 0),
            breakdown: fund.score_breakdown || {},
            metricsUsed,
            totalPossibleMetrics: totalPossible,
            confidence
          },

          firmAUM: Number(own.firm_aum || 0),
          advisorCount: Number(own.advisor_count || 0)
        };
      });
    } catch (err) {
      console.error('Error fetching scored funds:', err);
      return [];
    }
  }

  async upsertMinimalFunds(tickers = []) {
    try {
      const unique = Array.from(new Set((tickers || []).map(t => dbUtils.cleanSymbol(t)).filter(Boolean)));
      if (unique.length === 0) return { count: 0 };
      const records = unique.map(ticker => ({ ticker, name: ticker, is_recommended: false }));
      const { error } = await supabase.from(TABLES.FUNDS).upsert(records, { onConflict: 'ticker', returning: 'minimal' });
      if (error) throw error;
      return { count: unique.length };
    } catch (error) {
      handleSupabaseError(error, 'upsertMinimalFunds');
      return { count: 0 };
    }
  }

  // Get fund by ticker
  async getFund(ticker) {
    try {
      const { data, error } = await supabase
        .from(TABLES.FUNDS)
        .select('*')
        .eq('ticker', dbUtils.cleanSymbol(ticker))
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      handleSupabaseError(error, 'getFund');
      return null;
    }
  }

  // Add or update fund
  async saveFund(fundData) {
    try {
      const cleanTicker = dbUtils.cleanSymbol(fundData.ticker);
      const fund = {
        ticker: cleanTicker,
        name: fundData.name || fundData['Fund Name'] || '',
        asset_class: fundData.asset_class || fundData['Asset Class'] || '',
        asset_class_id: fundData.asset_class_id || null,
        is_recommended: fundData.is_recommended || false,
        added_date: fundData.added_date || dbUtils.formatDate(new Date()),
        notes: fundData.notes || '',
        last_updated: dbUtils.formatDate(new Date())
      };

      const { data, error } = await supabase
        .from(TABLES.FUNDS)
        .upsert(fund, { onConflict: 'ticker' })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      handleSupabaseError(error, 'saveFund');
      throw error;
    }
  }

  // Delete fund
  async deleteFund(ticker) {
    try {
      const { error } = await supabase
        .from(TABLES.FUNDS)
        .delete()
        .eq('ticker', dbUtils.cleanSymbol(ticker));

      if (error) throw error;
      return true;
    } catch (error) {
      handleSupabaseError(error, 'deleteFund');
      return false;
    }
  }

  // Get fund performance data
  async getFundPerformance(ticker, date = null) {
    try {
      let query = supabase
        .from(TABLES.FUND_PERFORMANCE)
        .select('*')
        .eq('fund_ticker', dbUtils.cleanSymbol(ticker));

      if (date) {
        // Fallback to latest row on or before the specified date
        query = query
          .lte('date', dbUtils.formatDateOnly(date))
          .order('date', { ascending: false })
          .limit(1);
      } else {
        query = query.order('date', { ascending: false }).limit(1);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Return empty object if no performance data found
      if (!data || data.length === 0) {
        return {
          ytd_return: null,
          one_year_return: null,
          three_year_return: null,
          five_year_return: null,
          ten_year_return: null,
          sharpe_ratio: null,
          standard_deviation: null,
          expense_ratio: null,
          alpha: null,
          beta: null,
          manager_tenure: null,
          // NEW FIELDS
          up_capture_ratio: null,
          down_capture_ratio: null,
          category_rank: null,
          sec_yield: null,
          fund_family: null
        };
      }
      
      return date ? data[0] : data[0];
    } catch (error) {
      handleSupabaseError(error, 'getFundPerformance');
      return {
        ytd_return: null,
        one_year_return: null,
        three_year_return: null,
        five_year_return: null,
        ten_year_return: null,
        sharpe_ratio: null,
        standard_deviation: null,
        expense_ratio: null,
        alpha: null,
        beta: null,
        manager_tenure: null,
        // NEW FIELDS
        up_capture_ratio: null,
        down_capture_ratio: null,
        category_rank: null,
        sec_yield: null,
        fund_family: null
      };
    }
  }

  // Save fund performance data
  async saveFundPerformance(performanceData) {
    try {
      const p = performanceData;
      const pmn = dbUtils.parseMetricNumber;
      const performance = {
        fund_ticker: dbUtils.cleanSymbol(p.ticker),
        date: dbUtils.formatDateOnly(p.date || new Date()),
        ytd_return: pmn(p.ytd_return ?? p.YTD),
        one_year_return: pmn(p.one_year_return ?? p['1 Year']),
        three_year_return: pmn(p.three_year_return ?? p['3 Year']),
        five_year_return: pmn(p.five_year_return ?? p['5 Year']),
        ten_year_return: pmn(p.ten_year_return ?? p['10 Year']),
        sharpe_ratio: pmn(p.sharpe_ratio ?? p['Sharpe Ratio']),
        // legacy standard_deviation used as raw historical single metric; keep stored for back-compat if present
        standard_deviation: pmn(p.standard_deviation ?? p['Standard Deviation']),
        standard_deviation_3y: pmn(
          p.standard_deviation_3y
          ?? p['standard_deviation_3y']
          ?? p['Standard Deviation 3Y']
          ?? p.standard_deviation
          ?? p['Standard Deviation']
        ),
        standard_deviation_5y: pmn(
          p.standard_deviation_5y
          ?? p['standard_deviation_5y']
          ?? p['Standard Deviation 5Y']
        ),
        expense_ratio: pmn(p.expense_ratio ?? p['Net Expense Ratio']),
        alpha: pmn(p.alpha ?? p.alpha_5y ?? p.Alpha),
        beta: pmn(p.beta ?? p.beta_3y ?? p.Beta),
        manager_tenure: pmn(p.manager_tenure ?? p['Manager Tenure']),
        // NEW FIELDS - Capture ratios and additional data
        up_capture_ratio: pmn(
          p.up_capture_ratio
          ?? p.up_capture_ratio_3y
          ?? p['Up Capture Ratio']
          ?? p['Up Capture Ratio (Morningstar Standard) - 3 Year']
        ),
        down_capture_ratio: pmn(
          p.down_capture_ratio
          ?? p.down_capture_ratio_3y
          ?? p['Down Capture Ratio']
          ?? p['Down Capture Ratio (Morningstar Standard) - 3 Year']
        ),
        category_rank: pmn(p.category_rank ?? p['Category Rank']),
        sec_yield: pmn(p.sec_yield ?? p['SEC Yield']),
        fund_family: p.fund_family ?? p['Fund Family'] ?? null
      };

      const { data, error } = await supabase
        .from(TABLES.FUND_PERFORMANCE)
        .upsert(performance, { onConflict: 'fund_ticker,date' })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      handleSupabaseError(error, 'saveFundPerformance');
      throw error;
    }
  }

  // Update fund data from Ycharts API
  async updateFundFromAPI(ticker) {
    try {
      console.log(`Updating fund data for ${ticker} from Ycharts API...`);
      
      // Fetch data from Ycharts
      const apiData = await ychartsAPI.getFundData(ticker);
      if (!apiData) {
        throw new Error(`No data returned from Ycharts API for ${ticker}`);
      }

      // Use simple asset class assignment - complex resolution removed
      const fundData = {
        ticker: ticker,
        name: apiData.name || '',
        asset_class: apiData.asset_class || '',
        asset_class_id: null, // Will be assigned through admin UI when needed
        is_recommended: false // Will be updated separately
      };

      await this.saveFund(fundData);

      // Save performance data
      const performanceData = {
        ticker: ticker,
        date: new Date(),
        ytd_return: apiData.ytd_return,
        one_year_return: apiData.one_year_return,
        three_year_return: apiData.three_year_return,
        five_year_return: apiData.five_year_return,
        ten_year_return: apiData.ten_year_return,
        sharpe_ratio: apiData.sharpe_ratio,
        standard_deviation: apiData.standard_deviation,
        expense_ratio: apiData.expense_ratio,
        alpha: apiData.alpha,
        beta: apiData.beta,
        manager_tenure: apiData.manager_tenure,
        // NEW FIELDS - Capture ratios and additional data
        up_capture_ratio: apiData.up_capture_ratio,
        down_capture_ratio: apiData.down_capture_ratio,
        category_rank: apiData.category_rank,
        sec_yield: apiData.sec_yield,
        fund_family: apiData.fund_family
      };

      await this.saveFundPerformance(performanceData);

      console.log(`Successfully updated fund data for ${ticker}`);
      return true;
    } catch (error) {
      console.error(`Failed to update fund data for ${ticker}:`, error);
      throw error;
    }
  }

  // Batch update multiple funds from API
  async batchUpdateFromAPI(tickers) {
    const results = [];
    
    for (const ticker of tickers) {
      try {
        await this.updateFundFromAPI(ticker);
        results.push({ ticker, success: true });
      } catch (error) {
        results.push({ ticker, success: false, error: error.message });
      }
      
      // Add delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return results;
  }

  // Get funds by asset class
  async getFundsByAssetClass(assetClass) {
    try {
      const { data, error } = await supabase
        .from(TABLES.FUNDS)
        .select('*')
        .eq('asset_class', assetClass)
        .order('ticker');

      if (error) throw error;
      return data || [];
    } catch (error) {
      handleSupabaseError(error, 'getFundsByAssetClass');
      return [];
    }
  }

  // Get recommended funds
  async getRecommendedFunds() {
    try {
      const { data, error } = await supabase
        .from(TABLES.FUNDS)
        .select('*')
        .eq('is_recommended', true)
        .order('ticker');

      if (error) throw error;
      return data || [];
    } catch (error) {
      handleSupabaseError(error, 'getRecommendedFunds');
      return [];
    }
  }

  // Ownership summary (RPC-backed) => { ticker -> { firm_aum, advisor_count, avg_position_size } }
  async getOwnershipSummary(asOfDate = null) {
    const asOf = asOfDate ? new Date(asOfDate + 'T00:00:00Z') : null;
    const dateOnly = asOf ? asOf.toISOString().slice(0,10) : null;
    if (this._ownershipCache && this._ownershipCache.has(dateOnly)) {
      return this._ownershipCache.get(dateOnly);
    }
    const map = new Map();
    try {
      // get_fund_ownership_summary RPC was deleted, skip to fallback
      console.warn('get_fund_ownership_summary RPC no longer available, using utilization fallback');
    } catch {}
    // Fallback: use fund_utilization MV RPC and adapt field names
    try {
      const { data, error } = await supabase.rpc('get_fund_utilization', { p_date: dateOnly, p_asset_class: null, p_limit: 5000 });
      if (error) throw error;
      (data || []).forEach(r => {
        if (!r?.ticker) return;
        map.set(r.ticker, {
          ticker: r.ticker,
          firm_aum: Number(r.total_aum || 0),
          advisor_count: Number(r.advisors_using || 0),
          avg_position_size: Number(r.avg_position_usd || 0)
        });
      });
      if (this._ownershipCache) this._ownershipCache.set(dateOnly, map);
      return map;
    } catch {
      return new Map();
    }
  }

  // Funds enriched with ownership metrics (firmAUM, advisorCount)
  async getFundsWithOwnership(asOfDate = null) {
    const asOf = asOfDate ? new Date(asOfDate + 'T00:00:00Z') : null;
    const dateOnly = asOf ? asOf.toISOString().slice(0,10) : null;
    if (this._fundsWithOwnershipCache && this._fundsWithOwnershipCache.has(dateOnly)) {
      return this._fundsWithOwnershipCache.get(dateOnly);
    }
    const [funds, ownMap] = await Promise.all([
      this.getAllFundsWithScoring(asOfDate),
      this.getOwnershipSummary(asOfDate)
    ]);
    const merged = (funds || []).map(f => {
      const o = ownMap.get(f.ticker) || {};
      return {
        ...f,
        firmAUM: Number(o.firm_aum || 0),
        advisorCount: Number(o.advisor_count || 0),
        avg_position_size: Number(o.avg_position_size || 0)
      };
    });
    if (this._fundsWithOwnershipCache) this._fundsWithOwnershipCache.set(dateOnly, merged);
    return merged;
  }

  // Recommended funds with ownership summary
  async getRecommendedFundsWithOwnership(asOfDate = null) {
    const all = await this.getFundsWithOwnership(asOfDate);
    return (all || []).filter(f => f.is_recommended);
  }

  // Search funds by name or ticker
  async searchFunds(query) {
    try {
      const { data, error } = await supabase
        .from(TABLES.FUNDS)
        .select('*')
        .or(`ticker.ilike.%${query}%,name.ilike.%${query}%`)
        .order('ticker');

      if (error) throw error;
      return data || [];
    } catch (error) {
      handleSupabaseError(error, 'searchFunds');
      return [];
    }
  }

  // Get fund performance history
  async getFundPerformanceHistory(ticker, startDate = null, endDate = null) {
    try {
      let query = supabase
        .from(TABLES.FUND_PERFORMANCE)
        .select('*')
        .eq('fund_ticker', dbUtils.cleanSymbol(ticker))
        .order('date', { ascending: false });

      if (startDate) {
        query = query.gte('date', dbUtils.formatDateOnly(startDate));
      }
      if (endDate) {
        query = query.lte('date', dbUtils.formatDateOnly(endDate));
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      handleSupabaseError(error, 'getFundPerformanceHistory');
      return [];
    }
  }

  // Bulk upsert performance rows
  async bulkUpsertFundPerformance(rows = [], chunkSize = 500) {
    const USE_FAST = (process.env.REACT_APP_IMPORT_FAST || 'false') === 'true';
    if (!Array.isArray(rows) || rows.length === 0) return { success: 0, failed: 0 };

    // JSON upsert path (default) with dedupe and validation
    if (!USE_FAST) {
      try {
        // Map inbound rows to fund/benchmark payloads using normalized keys only
        const pmn = dbUtils.parseMetricNumber;
        const METRIC_KEYS = [
          'ytd_return','one_year_return','three_year_return','five_year_return','ten_year_return',
          'sharpe_ratio','standard_deviation_3y','standard_deviation_5y',
          'expense_ratio','alpha','beta','manager_tenure','up_capture_ratio','down_capture_ratio'
        ];
        const fundPayloadRaw = [];
        const benchPayloadRaw = [];
        for (const r of rows) {
          const cleanTicker = dbUtils.cleanSymbol(r.ticker || r.fund_ticker || '');
          const dateOnly = dbUtils.formatDateOnly(r.date || r.AsOfMonth || r.as_of_month);
          const base = { date: dateOnly };
          for (const k of METRIC_KEYS) base[k] = pmn(r[k]);
          // TRUST r.kind from UI for routing
          if (String(r.kind).toLowerCase() === 'benchmark') {
            benchPayloadRaw.push({ benchmark_ticker: cleanTicker, ...base });
          } else {
            fundPayloadRaw.push({ fund_ticker: cleanTicker, ...base });
          }
        }

        // Validate and dedupe helpers
        function dedupeAndValidate(list, keyFields) {
          const seen = new Map();
          let dropped = 0;
          for (const item of list) {
            const t = keyFields[0];
            const d = keyFields[1];
            const ticker = String(item[t] || '').toUpperCase();
            const date = String(item[d] || '');
            if (!ticker || !date) { dropped++; continue; }
            const key = `${ticker}::${date}`;
            seen.set(key, { ...item, [t]: ticker, [d]: date }); // keep last occurrence
          }
          return { rows: Array.from(seen.values()), dropped };
        }

        const fundValidated = dedupeAndValidate(fundPayloadRaw, ['fund_ticker', 'date']);
        const benchValidated = dedupeAndValidate(benchPayloadRaw, ['benchmark_ticker', 'date']);

        let success = 0;
        let failed = 0;
        const errors = [];

        async function upsertChunks(table, payload, conflict) {
          for (let i = 0; i < payload.length; i += 50) {
            const chunk = payload.slice(i, i + 50);
            const { error } = await supabase
              .from(table)
              .upsert(chunk, { onConflict: conflict, returning: 'minimal' });
            if (error) {
              failed += chunk.length;
              errors.push({
                table,
                indexStart: i,
                message: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code
              });
            } else {
              success += chunk.length;
            }
          }
        }

        if (fundPayloadRaw.length) {
          // eslint-disable-next-line no-console
          console.log('[Import about to upsert] sample fund row', fundPayloadRaw[0]);
        }
        if (benchPayloadRaw.length) {
          // eslint-disable-next-line no-console
          console.log('[Import about to upsert] sample benchmark row', benchPayloadRaw[0]);
        }

        await upsertChunks(TABLES.FUND_PERFORMANCE, fundValidated.rows, 'fund_ticker,date');
        await upsertChunks(TABLES.BENCHMARK_PERFORMANCE, benchValidated.rows, 'benchmark_ticker,date');

        if (errors.length > 0) {
          // Aggregate and throw for UI to surface
          const head = errors[0];
          const err = new Error(`Import errors: ${errors.length}. First: ${head.message || ''} | ${head.details || ''} | ${head.hint || ''} | ${head.code || ''}`);
          // @ts-ignore attach for UI/debug
          err._importErrors = errors;
          throw err;
        }
        // Post-import sanity probe for the active import date
        try {
          const importDate = dbUtils.formatDateOnly(rows[0]?.date || rows[0]?.AsOfMonth || rows[0]?.as_of_month);
          const fields = 'fund_ticker,ytd_return,one_year_return,sharpe_ratio';
          const { data: probe } = await supabase
            .from(TABLES.FUND_PERFORMANCE)
            .select(fields)
            .eq('date', importDate)
            .limit(5);
          // eslint-disable-next-line no-console
          console.log('[Import probe]', probe);
          const metrics = ['ytd_return','one_year_return','sharpe_ratio'];
          const allNull = Array.isArray(probe) && probe.length > 0 && probe.every(row => metrics.every(m => row?.[m] == null));
          if (allNull) {
            return { success, failed: failed + fundValidated.dropped + benchValidated.dropped, warning: `All fund metrics null for ${importDate} â€” check mapping` };
          }
        } catch (_) {
          // non-fatal
        }

        return { success, failed: failed + fundValidated.dropped + benchValidated.dropped };
      } catch (e) {
        handleSupabaseError(e, 'bulkUpsertFundPerformance(json)');
        throw e;
      }
    }

        // FAST path (legacy column-mapped upsert)
    const toBatches = [];
    for (let i = 0; i < rows.length; i += chunkSize) {
      toBatches.push(rows.slice(i, i + chunkSize));
    }
    let success = 0;
    let failed = 0;
    for (const batch of toBatches) {
      const pmn = dbUtils.parseMetricNumber;
      // Build two payloads
      const fundPayload = [];
      const benchmarkPayload = [];
        for (const r of batch) {
        const clean = dbUtils.cleanSymbol(r.ticker || r.fund_ticker || r.benchmark_ticker);
        const base = {
          date: dbUtils.formatDateOnly(r.date || r.AsOfMonth || r.as_of_month),
          ytd_return: pmn(r.ytd_return ?? r['YTD']),
          one_year_return: pmn(r.one_year_return ?? r['1 Year']),
          three_year_return: pmn(r.three_year_return ?? r['3 Year']),
          five_year_return: pmn(r.five_year_return ?? r['5 Year']),
          ten_year_return: pmn(r.ten_year_return ?? r['10 Year']),
          sharpe_ratio: pmn(r.sharpe_ratio ?? r['Sharpe Ratio']),
          standard_deviation: pmn(r.standard_deviation ?? r['Standard Deviation']),
          standard_deviation_3y: pmn(
            r.standard_deviation_3y ?? r['standard_deviation_3y'] ?? r['Standard Deviation 3Y'] ?? r.standard_deviation ?? r['Standard Deviation']
          ),
          standard_deviation_5y: pmn(
            r.standard_deviation_5y ?? r['standard_deviation_5y'] ?? r['Standard Deviation 5Y']
          ),
          expense_ratio: pmn(r.expense_ratio ?? r['Net Expense Ratio']),
          alpha: pmn(r.alpha ?? r.alpha_5y ?? r['Alpha']),
          beta: pmn(r.beta ?? r.beta_3y ?? r['Beta']),
          manager_tenure: pmn(r.manager_tenure ?? r['Manager Tenure']),
          up_capture_ratio: pmn(
            r.up_capture_ratio ?? r.up_capture_ratio_3y ?? r['Up Capture Ratio'] ?? r['Up Capture Ratio (Morningstar Standard) - 3 Year']
          ),
          down_capture_ratio: pmn(
            r.down_capture_ratio ?? r.down_capture_ratio_3y ?? r['Down Capture Ratio'] ?? r['Down Capture Ratio (Morningstar Standard) - 3 Year']
          )
        };

        // TRUST r.kind from UI for routing (no service-side reinterpretation)
        let kind = String(r.kind || '').toLowerCase();
        if (kind === 'benchmark') {
          benchmarkPayload.push({ benchmark_ticker: clean, ...base });
        } else {
          fundPayload.push({ fund_ticker: clean, ...base });
        }
      }

      // Upserts
      if (fundPayload.length > 0) {
        const { error: fundErr } = await supabase
          .from(TABLES.FUND_PERFORMANCE)
          .upsert(fundPayload, { onConflict: 'fund_ticker,date' });
        if (fundErr) failed += fundPayload.length; else success += fundPayload.length;
      }
      if (benchmarkPayload.length > 0) {
        const { error: benchErr } = await supabase
          .from(TABLES.BENCHMARK_PERFORMANCE)
          .upsert(benchmarkPayload, { onConflict: 'benchmark_ticker,date' });
        if (benchErr) failed += benchmarkPayload.length; else success += benchmarkPayload.length;
      }
    }
    return { success, failed };
  }

  // List snapshot dates with counts
  async listSnapshotsWithCounts() {
    try {
      // Prefer RPC for robust grouping across drivers
      const { data: rpcData, error: rpcError } = await supabase.rpc('list_snapshot_counts');
      if (!rpcError && Array.isArray(rpcData)) {
        return (rpcData || []).map((r) => ({ date: dbUtils.formatDateOnly(r.date), rows: Number(r.rows) || 0 }));
      }

      // Fallback: client-side reduction over minimal selection
      const { data: rowsData, error: selError } = await supabase
        .from(TABLES.FUND_PERFORMANCE)
        .select('date');
      if (selError) throw selError;
      const counts = new Map();
      for (const r of rowsData || []) {
        const d = dbUtils.formatDateOnly(r.date);
        counts.set(d, (counts.get(d) || 0) + 1);
      }
      return Array.from(counts.entries())
        .map(([date, rows]) => ({ date, rows }))
        .sort((a, b) => b.date.localeCompare(a.date));
    } catch (error) {
      handleSupabaseError(error, 'listSnapshotsWithCounts');
      return [];
    }
  }

  // Delete all rows for a given snapshot date
  async deleteSnapshotMonth(date) {
    try {
      const { error } = await supabase
        .from(TABLES.FUND_PERFORMANCE)
        .delete()
        .eq('date', dbUtils.formatDateOnly(date));
      if (error) throw error;
      return true;
    } catch (error) {
      handleSupabaseError(error, 'deleteSnapshotMonth');
      return false;
    }
  }

  // List distinct snapshot months (dates) present in fund_performance
  async listSnapshotMonths(limit = 240) {
    try {
      const { data, error } = await supabase
        .from(TABLES.FUND_PERFORMANCE)
        .select('date')
        .order('date', { ascending: false })
        .limit(limit * 1000); // guardrail; many tickers share same date
      if (error) throw error;
      const seen = new Set();
      const months = [];
      for (const row of data || []) {
        const d = dbUtils.formatDateOnly(row.date);
        if (!seen.has(d)) {
          seen.add(d);
          months.push(d);
        }
        if (months.length >= limit) break;
      }
      return months;
    } catch (error) {
      handleSupabaseError(error, 'listSnapshotMonths');
      return [];
    }
  }

  // Convert a non-EOM snapshot to EOM date, merging if target exists
  async convertSnapshotToEom(sourceDate) {
    try {
      const src = dbUtils.formatDateOnly(sourceDate);
      const d = new Date(src + 'T00:00:00Z');
      const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0,10);
      if (src === target) return { merged: false, moved: 0 };

      // Check if target exists
      const { data: existing } = await supabase
        .from(TABLES.FUND_PERFORMANCE)
        .select('fund_ticker')
        .eq('date', target)
        .limit(1);
      const targetExists = Array.isArray(existing) && existing.length > 0;

      // Move rows: select all from source
      const { data: rows, error: selErr } = await supabase
        .from(TABLES.FUND_PERFORMANCE)
        .select('*')
        .eq('date', src);
      if (selErr) throw selErr;

      if (!rows || rows.length === 0) return { merged: targetExists, moved: 0 };

      // Re-insert at target with upsert conflict on (fund_ticker,date)
      const payload = rows.map((r) => ({ ...r, date: target }));
      // Strip PK/created_at to allow upsert
      payload.forEach(p => { delete p.id; delete p.created_at; });
      const { error: upErr } = await supabase
        .from(TABLES.FUND_PERFORMANCE)
        .upsert(payload, { onConflict: 'fund_ticker,date' });
      if (upErr) throw upErr;

      // Delete source rows
      const { error: delErr } = await supabase
        .from(TABLES.FUND_PERFORMANCE)
        .delete()
        .eq('date', src);
      if (delErr) throw delErr;

      return { merged: targetExists, moved: rows.length };
    } catch (error) {
      handleSupabaseError(error, 'convertSnapshotToEom');
      throw error;
    }
  }

  // Return list of all fund tickers
  async listFundTickers() {
    try {
      const { data, error } = await supabase
        .from(TABLES.FUNDS)
        .select('ticker');
      if (error) throw error;
      return (data || []).map((r) => r.ticker?.toUpperCase()).filter(Boolean);
    } catch (error) {
      handleSupabaseError(error, 'listFundTickers');
      return [];
    }
  }

  // Return list of benchmark tickers and names
  async listBenchmarkTickers() {
    try {
      const { data, error } = await supabase
        .from(TABLES.BENCHMARKS)
        .select('ticker,name');
      if (error) throw error;
      return (data || []).map((r) => ({ ticker: r.ticker?.toUpperCase(), name: r.name }));
    } catch (error) {
      handleSupabaseError(error, 'listBenchmarkTickers');
      return [];
    }
  }

  // Get asset class table data with optional benchmark row
  async getAssetClassTable(asOfDate, assetClassId, includeBenchmark = true) {
    try {
      const asOf = asOfDate ? new Date(asOfDate + 'T00:00:00Z') : null;
      const dateOnly = asOf ? asOf.toISOString().slice(0, 10) : null;

      let result;
      // Use server-side scoring when enabled
      if (this.useServerScoring) {
        result = await this.getAssetClassTableWithServerScoring(dateOnly, assetClassId, includeBenchmark);
      } else {
        // Use new fundDataService instead of deleted get_asset_class_table RPC
        const { getFundsWithPerformance } = await import('./fundDataService.js');
        const funds = await getFundsWithPerformance(dateOnly, assetClassId);
        result = funds || [];
      }
      return result;
    } catch (error) {
      handleSupabaseError(error, 'getAssetClassTable');
      console.error('fundService.getAssetClassTable: error', error);
      return [];
    }
  }

  // Get asset class table with server-side scoring
  async getAssetClassTableWithServerScoring(dateOnly, assetClassId, includeBenchmark) {
    try {
      // Use new fundDataService instead of deleted calculate_scores_as_of RPC
      const { getFundsWithPerformance } = await import('./fundDataService.js');
      const scoredFunds = await getFundsWithPerformance(dateOnly, assetClassId);
      
      if (!scoredFunds || scoredFunds.length === 0) {
        console.warn('No funds found for asset class:', assetClassId);
        return [];
      }

      // Fetch performance if missing on scored rows
      let perfMap = new Map();
      const needsPerf = Array.isArray(scoredFunds) && scoredFunds.length > 0
        ? !('ytd_return' in (scoredFunds[0] || {}))
        : false;
      if (needsPerf) {
        // Use new fundDataService instead of deleted RPC
        const { getFundsWithPerformance } = await import('./fundDataService.js');
        const perfData = await getFundsWithPerformance(dateOnly);
        perfMap = new Map((perfData || []).map(f => [f.ticker, f]));
      }

      // Ownership
      const ownMap = await this.getOwnershipSummary(dateOnly);

      const rows = (scoredFunds || []).filter(r => includeBenchmark ? true : !r.is_benchmark);

      return rows.map(fund => {
        const perf = perfMap.get(fund.ticker) || {};
        const metricsUsed = Number(fund.metrics_used || 0);
        const totalPossible = Number(fund.total_possible_metrics || 0);
        const confidence = (metricsUsed && totalPossible)
          ? Math.round((metricsUsed / totalPossible) * 100)
          : 0;
        const own = ownMap.get(fund.ticker) || {};

        return {
          ticker: fund.ticker,
          name: fund.name,
          asset_class_id: fund.asset_class_id || perf.asset_class_id || assetClassId || null,
          is_benchmark: !!fund.is_benchmark,
          is_recommended: !!fund.is_recommended,

          ytd_return: fund.ytd_return ?? perf.ytd_return,
          one_year_return: fund.one_year_return ?? perf.one_year_return,
          three_year_return: fund.three_year_return ?? perf.three_year_return,
          five_year_return: fund.five_year_return ?? perf.five_year_return,
          ten_year_return: fund.ten_year_return ?? perf.ten_year_return,
          sharpe_ratio: fund.sharpe_ratio ?? perf.sharpe_ratio,
          standard_deviation: fund.standard_deviation ?? perf.standard_deviation,
          standard_deviation_3y: fund.standard_deviation_3y ?? perf.standard_deviation_3y,
          standard_deviation_5y: fund.standard_deviation_5y ?? perf.standard_deviation_5y,
          expense_ratio: fund.expense_ratio ?? perf.expense_ratio,
          alpha: fund.alpha ?? perf.alpha,
          beta: fund.beta ?? perf.beta,
          manager_tenure: fund.manager_tenure ?? perf.manager_tenure,
          up_capture_ratio: fund.up_capture_ratio ?? perf.up_capture_ratio,
          down_capture_ratio: fund.down_capture_ratio ?? perf.down_capture_ratio,
          category_rank: fund.category_rank ?? perf.category_rank,
          sec_yield: fund.sec_yield ?? perf.sec_yield,
          fund_family: fund.fund_family ?? perf.fund_family,
          date: fund.perf_date ?? perf.perf_date,

          score: Number(fund.score_final || 0),
          score_final: Number(fund.score_final || 0),
          score_raw: Number(fund.score_raw || 0),
          percentile: Number(fund.percentile || 0),

          scores: {
            final: Number(fund.score_final || 0),
            raw: Number(fund.score_raw || 0),
            percentile: Number(fund.percentile || 0),
            breakdown: fund.score_breakdown || {},
            metricsUsed,
            totalPossibleMetrics: totalPossible,
            confidence
          },

          firmAUM: Number(own.firm_aum || 0),
          advisorCount: Number(own.advisor_count || 0)
        };
      });
    } catch (err) {
      console.error('Error in getAssetClassTableWithServerScoring:', err);
      return [];
    }
  }

  // Get scores for asset class with pagination
  async getScoresAsOf(asOfDate, assetClassId, limit = 500, after = null) {
    try {
      const asOf = asOfDate ? new Date(asOfDate + 'T00:00:00Z') : null;
      const dateOnly = asOf ? asOf.toISOString().slice(0, 10) : null;
      const { data, error } = await supabase.rpc('get_scores_as_of', {
        p_date: dateOnly,
        p_asset_class_id: assetClassId,
        p_limit: limit,
        p_after: after
      });
      if (error) throw error;
      return data || [];
    } catch (error) {
      handleSupabaseError(error, 'getScoresAsOf');
      return [];
    }
  }

  // Get batched history for multiple tickers (eliminates N+1 queries)
  async getHistoryForTickers(tickers, asOfDate = null) {
    try {
      const asOf = asOfDate ? new Date(asOfDate + 'T00:00:00Z') : null;
      const dateOnly = asOf ? asOf.toISOString().slice(0, 10) : null;
      const { data, error } = await supabase.rpc('get_history_for_tickers', {
        p_tickers: tickers || [],
        p_to: dateOnly
      });
      if (error) throw error;
      return data || [];
    } catch (error) {
      handleSupabaseError(error, 'getHistoryForTickers');
      return [];
    }
  }

  // Get comparison dataset using enhanced RPC
  async getCompareDataset(asOfDate = null, tickers = [], benchmarkTicker = null) {
    try {
      const asOf = asOfDate ? new Date(asOfDate + 'T00:00:00Z') : null;
      const dateOnly = asOf ? asOf.toISOString().slice(0, 10) : null;
      
      const params = {
        p_date: dateOnly,
        p_tickers: tickers
      };

      // Use the version with benchmark parameter if available
      if (benchmarkTicker) {
        params.p_benchmark_ticker = benchmarkTicker;
        const { data, error } = await supabase.rpc('get_compare_dataset', params);
        if (error) throw error;
        return data || [];
      } else {
        // Use backwards compatible version
        const { data, error } = await supabase.rpc('get_compare_dataset', {
          p_date: dateOnly,
          p_tickers: tickers
        });
        if (error) throw error;
        return data || [];
      }
    } catch (error) {
      handleSupabaseError(error, 'getCompareDataset');
      return [];
    }
  }

  // Get all benchmarks for selection
  async getAllBenchmarks() {
    try {
      const { data, error } = await supabase
        .from(TABLES.BENCHMARKS)
        .select('ticker, name, proxy_type')
        .order('name');
      if (error) throw error;
      return data || [];
    } catch (error) {
      handleSupabaseError(error, 'getAllBenchmarks');
      return [];
    }
  }
}

// Create singleton instance
const fundService = new FundService();

export default fundService; 
