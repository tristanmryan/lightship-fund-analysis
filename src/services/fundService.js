// src/services/fundService.js
import { supabase, TABLES, dbUtils, handleSupabaseError } from './supabase';
import { resolveAssetClassForTicker } from './resolvers/assetClassResolver';
import ychartsAPI from './ychartsAPI';

class FundService {
  // Get all funds from database with performance at a given date (or latest if null)
  async getAllFunds(asOfDate = null) {
    try {
      // First get all funds
      const { data: funds, error: fundsError } = await supabase
        .from(TABLES.FUNDS)
        .select('*')
        .order('ticker');

      if (fundsError) throw fundsError;
      if (!funds || funds.length === 0) return [];

      // Join with asset_classes for normalized fields
      const fundsWithClasses = await Promise.all(
        funds.map(async (fund) => {
          let assetClass = null;
          if (fund.asset_class_id) {
            const { data: ac } = await supabase.from(TABLES.ASSET_CLASSES)
              .select('id, code, name, group_name, sort_group, sort_order')
              .eq('id', fund.asset_class_id)
              .maybeSingle();
            assetClass = ac || null;
          }
          const performance = await this.getFundPerformance(fund.ticker, asOfDate);
          return {
            ...fund,
            ...performance,
            symbol: fund.ticker, // temporary alias for legacy reads
            asset_class_id: assetClass?.id || fund.asset_class_id || null,
            asset_class_code: assetClass?.code || null,
            asset_class_name: assetClass?.name || fund.asset_class || null,
            asset_group_name: assetClass?.group_name || null,
            asset_group_sort: assetClass?.sort_group || null,
            asset_class_sort: assetClass?.sort_order || null
          };
        })
      );

      return fundsWithClasses;
    } catch (error) {
      handleSupabaseError(error, 'getAllFunds');
      return [];
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
        // Query by date-only equality against DATE column
        query = query.eq('date', dbUtils.formatDateOnly(date));
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

      // Resolve asset class via Supabase dictionary first
      const { asset_class_id, asset_class_name } = await resolveAssetClassForTicker(ticker, apiData.asset_class);
      const fundData = {
        ticker: ticker,
        name: apiData.name || '',
        asset_class: asset_class_name || apiData.asset_class || '',
        asset_class_id: asset_class_id || null,
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

  // Bulk upsert performance rows: funds go to fund_performance; benchmarks to benchmark_performance
  async bulkUpsertFundPerformance(rows = [], chunkSize = 500) {
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

        // Heuristic: if row.flagKind says benchmark or if explicit benchmark_ticker provided, treat as benchmark
        const kind = r.kind || (r.benchmark_ticker ? 'benchmark' : 'fund');
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
}

// Create singleton instance
const fundService = new FundService();

export default fundService; 