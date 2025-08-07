// src/services/fundService.js
import { supabase, TABLES, dbUtils, handleSupabaseError } from './supabase';
import ychartsAPI from './ychartsAPI';

class FundService {
  // Get all funds from database with latest performance data
  async getAllFunds() {
    try {
      // First get all funds
      const { data: funds, error: fundsError } = await supabase
        .from(TABLES.FUNDS)
        .select('*')
        .order('ticker');

      if (fundsError) throw fundsError;
      if (!funds || funds.length === 0) return [];

      // Get latest performance data for each fund
      const fundsWithPerformance = await Promise.all(
        funds.map(async (fund) => {
          const performance = await this.getFundPerformance(fund.ticker);
          return {
            ...fund,
            ...performance // Merge performance data with fund data
          };
        })
      );

      return fundsWithPerformance;
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
        query = query.eq('date', dbUtils.formatDate(date));
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
      const performance = {
        fund_ticker: dbUtils.cleanSymbol(performanceData.ticker),
        date: dbUtils.formatDate(performanceData.date || new Date()),
        ytd_return: dbUtils.parseNumeric(performanceData.ytd_return || performanceData.YTD),
        one_year_return: dbUtils.parseNumeric(performanceData.one_year_return || performanceData['1 Year']),
        three_year_return: dbUtils.parseNumeric(performanceData.three_year_return || performanceData['3 Year']),
        five_year_return: dbUtils.parseNumeric(performanceData.five_year_return || performanceData['5 Year']),
        ten_year_return: dbUtils.parseNumeric(performanceData.ten_year_return || performanceData['10 Year']),
        sharpe_ratio: dbUtils.parseNumeric(performanceData.sharpe_ratio || performanceData['Sharpe Ratio']),
        standard_deviation: dbUtils.parseNumeric(performanceData.standard_deviation || performanceData['Standard Deviation']),
        expense_ratio: dbUtils.parseNumeric(performanceData.expense_ratio || performanceData['Net Expense Ratio']),
        alpha: dbUtils.parseNumeric(performanceData.alpha || performanceData.Alpha),
        beta: dbUtils.parseNumeric(performanceData.beta || performanceData.Beta),
        manager_tenure: dbUtils.parseNumeric(performanceData.manager_tenure || performanceData['Manager Tenure']),
        // NEW FIELDS - Capture ratios and additional data
        up_capture_ratio: dbUtils.parseNumeric(performanceData.up_capture_ratio || performanceData['Up Capture Ratio']),
        down_capture_ratio: dbUtils.parseNumeric(performanceData.down_capture_ratio || performanceData['Down Capture Ratio']),
        category_rank: dbUtils.parseNumeric(performanceData.category_rank || performanceData['Category Rank']),
        sec_yield: dbUtils.parseNumeric(performanceData.sec_yield || performanceData['SEC Yield']),
        fund_family: performanceData.fund_family || performanceData['Fund Family'] || null
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

      // Save fund info
      const fundData = {
        ticker: ticker,
        name: apiData.name || '',
        asset_class: apiData.asset_class || '',
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
        query = query.gte('date', dbUtils.formatDate(startDate));
      }
      if (endDate) {
        query = query.lte('date', dbUtils.formatDate(endDate));
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      handleSupabaseError(error, 'getFundPerformanceHistory');
      return [];
    }
  }
}

// Create singleton instance
const fundService = new FundService();

export default fundService; 