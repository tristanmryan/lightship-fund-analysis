-- Fix get_compare_dataset RPC Signature Conflict
-- Drop all conflicting versions and create single clean function

-- Drop all existing versions to clear conflicts
DROP FUNCTION IF EXISTS get_compare_dataset(date, text[], text);
DROP FUNCTION IF EXISTS get_compare_dataset(date, text[]);
DROP FUNCTION IF EXISTS get_compare_dataset(text[], text);
DROP FUNCTION IF EXISTS get_compare_dataset(text[]);

-- Create single clean version with proper parameter types
CREATE OR REPLACE FUNCTION get_compare_dataset(
  p_date date, 
  p_tickers text[], 
  p_benchmark text DEFAULT NULL
)
RETURNS TABLE (
  ticker text,
  name text,
  asset_class text,
  is_benchmark boolean,
  ytd_return numeric,
  one_year_return numeric,
  three_year_return numeric,
  five_year_return numeric,
  ten_year_return numeric,
  sharpe_ratio numeric,
  standard_deviation numeric,
  standard_deviation_3y numeric,
  standard_deviation_5y numeric,
  expense_ratio numeric,
  alpha numeric,
  beta numeric,
  up_capture_ratio numeric,
  down_capture_ratio numeric,
  manager_tenure numeric,
  benchmark_delta_ytd numeric,
  benchmark_delta_1y numeric,
  benchmark_delta_3y numeric,
  benchmark_delta_5y numeric,
  benchmark_delta_10y numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  benchmark_data record;
BEGIN
  -- Get benchmark data for delta calculations if benchmark is specified
  IF p_benchmark IS NOT NULL THEN
    SELECT * INTO benchmark_data
    FROM (
      -- Check fund_performance first
      SELECT 
        fp.ytd_return,
        fp.one_year_return,
        fp.three_year_return,
        fp.five_year_return,
        fp.ten_year_return
      FROM fund_performance fp
      WHERE fp.fund_ticker = p_benchmark 
        AND fp.date = p_date
      
      UNION ALL
      
      -- Check benchmark_performance
      SELECT 
        bp.ytd_return,
        bp.one_year_return,
        bp.three_year_return,
        bp.five_year_return,
        bp.ten_year_return
      FROM benchmark_performance bp
      WHERE bp.benchmark_ticker = p_benchmark 
        AND bp.date = p_date
    ) combined
    LIMIT 1;
  END IF;

  -- Return combined fund and benchmark data
  RETURN QUERY
  WITH funds_asof AS (
    -- Get fund data for selected tickers (only if they exist in funds table)
    SELECT 
      f.ticker,
      f.name,
      f.asset_class,
      false as is_benchmark_row,
      fp.ytd_return,
      fp.one_year_return,
      fp.three_year_return,
      fp.five_year_return,
      fp.ten_year_return,
      fp.sharpe_ratio,
      fp.standard_deviation,
      fp.standard_deviation_3y,
      fp.standard_deviation_5y,
      fp.expense_ratio,
      fp.alpha,
      fp.beta,
      fp.up_capture_ratio,
      fp.down_capture_ratio,
      fp.manager_tenure
    FROM funds f
    JOIN fund_performance fp ON f.ticker = fp.fund_ticker
    WHERE f.ticker = ANY(p_tickers)
      AND fp.date = p_date
  ),
  benchmarks_asof AS (
    -- Get benchmark data for selected tickers (only if they exist in benchmarks table)
    SELECT 
      b.ticker,
      b.name,
      b.asset_class,
      true as is_benchmark_row,
      bp.ytd_return,
      bp.one_year_return,
      bp.three_year_return,
      bp.five_year_return,
      bp.ten_year_return,
      bp.sharpe_ratio,
      bp.standard_deviation,
      bp.standard_deviation_3y,
      bp.standard_deviation_5y,
      bp.expense_ratio,
      bp.alpha,
      bp.beta,
      bp.up_capture_ratio,
      bp.down_capture_ratio,
      NULL as manager_tenure
    FROM benchmarks b
    JOIN benchmark_performance bp ON b.ticker = bp.benchmark_ticker
    WHERE b.ticker = ANY(p_tickers)
      AND bp.date = p_date
  ),
  combined_data AS (
    SELECT * FROM funds_asof
    UNION ALL
    SELECT * FROM benchmarks_asof
  )
  SELECT 
    cd.ticker,
    cd.name,
    cd.asset_class,
    cd.is_benchmark_row,
    cd.ytd_return,
    cd.one_year_return,
    cd.three_year_return,
    cd.five_year_return,
    cd.ten_year_return,
    cd.sharpe_ratio,
    cd.standard_deviation,
    cd.standard_deviation_3y,
    cd.standard_deviation_5y,
    cd.expense_ratio,
    cd.alpha,
    cd.beta,
    cd.up_capture_ratio,
    cd.down_capture_ratio,
    cd.manager_tenure,
    -- Calculate deltas vs benchmark if available
    CASE 
      WHEN benchmark_data.ytd_return IS NOT NULL THEN cd.ytd_return - benchmark_data.ytd_return
      ELSE NULL 
    END as benchmark_delta_ytd,
    CASE 
      WHEN benchmark_data.one_year_return IS NOT NULL THEN cd.one_year_return - benchmark_data.one_year_return
      ELSE NULL 
    END as benchmark_delta_1y,
    CASE 
      WHEN benchmark_data.three_year_return IS NOT NULL THEN cd.three_year_return - benchmark_data.three_year_return
      ELSE NULL 
    END as benchmark_delta_3y,
    CASE 
      WHEN benchmark_data.five_year_return IS NOT NULL THEN cd.five_year_return - benchmark_data.five_year_return
      ELSE NULL 
    END as benchmark_delta_5y,
    CASE 
      WHEN benchmark_data.ten_year_return IS NOT NULL THEN cd.ten_year_return - benchmark_data.ten_year_return
      ELSE NULL 
    END as benchmark_delta_10y
  FROM combined_data cd
  ORDER BY cd.is_benchmark_row, cd.ticker;
END;
$$;

-- Grant execute permission to anon role
GRANT EXECUTE ON FUNCTION get_compare_dataset(date, text[], text) TO anon;
GRANT EXECUTE ON FUNCTION get_compare_dataset(date, text[]) TO anon;

-- Add comment for documentation
COMMENT ON FUNCTION get_compare_dataset(date, text[], text) IS 'Get comparison dataset for funds and benchmarks with optional delta calculations'; 