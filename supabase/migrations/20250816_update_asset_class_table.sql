-- Update get_asset_class_table to use server-side scoring when REACT_APP_DB_SCORES is enabled
-- This preserves backward compatibility while adding the new scoring path

-- Drop the existing function
DROP FUNCTION IF EXISTS public.get_asset_class_table(date, uuid, boolean);

-- Recreate with server-side scoring integration
CREATE OR REPLACE FUNCTION public.get_asset_class_table(
  p_date date, 
  p_asset_class_id uuid DEFAULT NULL, 
  p_include_benchmark boolean DEFAULT true
)
RETURNS TABLE(
  asset_class_id uuid,
  ticker text,
  name text,
  is_benchmark boolean,
  is_recommended boolean,
  perf_date date,
  ytd_return numeric,
  one_year_return numeric,
  three_year_return numeric,
  five_year_return numeric,
  ten_year_return numeric,
  sharpe_ratio numeric,
  standard_deviation_3y numeric,
  standard_deviation_5y numeric,
  expense_ratio numeric,
  beta numeric,
  alpha numeric,
  up_capture_ratio numeric,
  down_capture_ratio numeric,
  manager_tenure numeric,
  score_final numeric,
  percentile int
)
LANGUAGE sql
STABLE
AS $$
  WITH funds_asof AS (
    SELECT * FROM public.get_funds_as_of(p_date) 
    WHERE asset_class_id = p_asset_class_id OR p_asset_class_id IS NULL
  ),
  primary_bench AS (
    SELECT 
      acb.asset_class_id,
      b.ticker,
      b.name
    FROM public.asset_class_benchmarks acb
    JOIN public.benchmarks b ON b.id = acb.benchmark_id
    WHERE acb.kind = 'primary' 
      AND (acb.asset_class_id = p_asset_class_id OR p_asset_class_id IS NULL)
  ),
  bench_perf AS (
    SELECT 
      pb.asset_class_id,
      pb.ticker AS benchmark_ticker,
      pb.name AS benchmark_name,
      bp.date AS perf_date,
      bp.ytd_return, bp.one_year_return, bp.three_year_return, 
      bp.five_year_return, bp.ten_year_return,
      bp.sharpe_ratio, bp.standard_deviation_3y, bp.standard_deviation_5y,
      bp.expense_ratio, bp.beta, bp.alpha, bp.up_capture_ratio, bp.down_capture_ratio
    FROM primary_bench pb
    LEFT JOIN LATERAL (
      SELECT * FROM public.benchmark_performance bpp
      WHERE bpp.benchmark_ticker = pb.ticker 
        AND bpp.date <= COALESCE(p_date, public._get_latest_fund_date())
      ORDER BY bpp.date DESC
      LIMIT 1
    ) bp ON true
  ),
  -- Server-side scoring when available, fallback to simple scoring
  fund_scores AS (
    SELECT 
      f.asset_class_id,
      f.ticker,
      -- Try server-side scoring first, fallback to simple scoring
      COALESCE(
        (SELECT ss.score_final FROM public.calculate_scores_as_of(p_date, f.asset_class_id) ss 
         WHERE ss.ticker = f.ticker AND NOT ss.is_benchmark LIMIT 1),
        -- Fallback: Basic scoring using 1-year return as primary metric
        CASE 
          WHEN f.one_year_return IS NOT NULL THEN
            LEAST(100, GREATEST(0, 50 + (f.one_year_return - 
              AVG(f.one_year_return) OVER (PARTITION BY f.asset_class_id)) * 5))
          ELSE NULL
        END
      ) AS score_final,
      -- Calculate percentile within asset class
      COALESCE(
        (SELECT ss.percentile FROM public.calculate_scores_as_of(p_date, f.asset_class_id) ss 
         WHERE ss.ticker = f.ticker AND NOT ss.is_benchmark LIMIT 1),
        -- Fallback percentile calculation
        CASE 
          WHEN f.one_year_return IS NOT NULL THEN
            ROUND(PERCENT_RANK() OVER (
              PARTITION BY f.asset_class_id 
              ORDER BY f.one_year_return ASC
            ) * 100)::int
          ELSE NULL
        END
      ) AS percentile
    FROM funds_asof f
    WHERE f.asset_class_id IS NOT NULL
  )
  SELECT * FROM (
    -- Return fund rows with scores
    SELECT 
      f.asset_class_id,
      f.ticker,
      f.name,
      false AS is_benchmark,
      f.is_recommended,
      f.perf_date,
      f.ytd_return, f.one_year_return, f.three_year_return, 
      f.five_year_return, f.ten_year_return,
      f.sharpe_ratio, f.standard_deviation_3y, f.standard_deviation_5y,
      f.expense_ratio, f.beta, f.alpha, f.up_capture_ratio, f.down_capture_ratio,
      f.manager_tenure,
      COALESCE(fs.score_final, 50.0) AS score_final,
      fs.percentile
    FROM funds_asof f
    LEFT JOIN fund_scores fs ON fs.asset_class_id = f.asset_class_id AND fs.ticker = f.ticker
    
    UNION ALL
    
    -- Return benchmark rows if requested (no scores for benchmarks)
    SELECT 
      bp.asset_class_id,
      bp.benchmark_ticker AS ticker,
      bp.benchmark_name AS name,
      true AS is_benchmark,
      false AS is_recommended,
      bp.perf_date,
      bp.ytd_return, bp.one_year_return, bp.three_year_return,
      bp.five_year_return, bp.ten_year_return,
      bp.sharpe_ratio, bp.standard_deviation_3y, bp.standard_deviation_5y,
      bp.expense_ratio, bp.beta, bp.alpha, bp.up_capture_ratio, bp.down_capture_ratio,
      NULL::numeric AS manager_tenure,
      NULL::numeric AS score_final,
      NULL::int AS percentile
    FROM bench_perf bp
    WHERE p_include_benchmark = true
  ) ranked_data
  ORDER BY 
    is_benchmark ASC, 
    CASE WHEN is_benchmark THEN ticker ELSE NULL END ASC,
    CASE WHEN NOT is_benchmark THEN COALESCE(score_final, 0) ELSE NULL END DESC NULLS LAST,
    ticker ASC;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_asset_class_table(date, uuid, boolean) TO anon, authenticated, service_role; 