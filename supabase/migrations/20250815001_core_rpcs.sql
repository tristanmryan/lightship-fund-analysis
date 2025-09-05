-- Migration: Core RPCs and Missing Asset Class Benchmark Index
-- This adds 6 critical RPCs needed for the bench harness and enforces 
-- the "exactly one primary benchmark per asset class" rule

-- Create missing asset class benchmark index to enforce uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS idx_acb_primary_unique 
ON asset_class_benchmarks(asset_class_id) 
WHERE kind='primary';

-- Helper function to safely get latest date from fund_performance
CREATE OR REPLACE FUNCTION public._get_latest_fund_date()
RETURNS date
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(MAX(date), CURRENT_DATE) FROM public.fund_performance;
$$;

GRANT EXECUTE ON FUNCTION public._get_latest_fund_date() TO anon, authenticated, service_role;

-- 1. get_active_month - Returns active month with EOM preference
CREATE OR REPLACE FUNCTION public.get_active_month(p_hint date DEFAULT NULL)
RETURNS TABLE(active date, is_eom boolean)
LANGUAGE sql
STABLE
AS $$
  WITH cand AS (
    SELECT COALESCE(
      (SELECT MAX(date) FROM public.fund_performance WHERE date <= COALESCE(p_hint, public._get_latest_fund_date())),
      (SELECT MAX(date) FROM public.fund_performance)
    ) AS d
  ),
  eom AS (
    SELECT 
      c.d AS picked,
      (DATE_TRUNC('month', c.d) + INTERVAL '1 month - 1 day')::date AS month_eom
    FROM cand c
  )
  SELECT 
    CASE 
      WHEN EXISTS (SELECT 1 FROM public.fund_performance WHERE date = e.month_eom)
      THEN e.month_eom 
      ELSE e.picked 
    END AS active,
    EXISTS (SELECT 1 FROM public.fund_performance WHERE date = e.month_eom) AS is_eom
  FROM eom e;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_month(date) TO anon, authenticated, service_role;

-- 2. get_asset_class_table - Returns fund data with optional benchmark row for an asset class
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
  -- Simple scoring calculation per asset class
  fund_scores AS (
    SELECT 
      f.asset_class_id,
      f.ticker,
      -- Basic scoring using 1-year return as primary metric for now
      CASE 
        WHEN f.one_year_return IS NOT NULL THEN
          LEAST(100, GREATEST(0, 50 + (f.one_year_return - 
            AVG(f.one_year_return) OVER (PARTITION BY f.asset_class_id)) * 5))
        ELSE NULL
      END AS score_final,
      -- Calculate percentile within asset class
      CASE 
        WHEN f.one_year_return IS NOT NULL THEN
          ROUND(PERCENT_RANK() OVER (
            PARTITION BY f.asset_class_id 
            ORDER BY f.one_year_return ASC
          ) * 100)::int
        ELSE NULL
      END AS percentile
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

GRANT EXECUTE ON FUNCTION public.get_asset_class_table(date, uuid, boolean) TO anon, authenticated, service_role;

-- 3. get_scores_as_of - Returns fund scores with rankings
CREATE OR REPLACE FUNCTION public.get_scores_as_of(
  p_date date, 
  p_asset_class_id uuid DEFAULT NULL, 
  p_limit int DEFAULT 50, 
  p_after text DEFAULT NULL
)
RETURNS TABLE(
  asset_class_id uuid,
  fund_ticker text,
  date date,
  score_final numeric,
  percentile int
)
LANGUAGE sql
STABLE
AS $$
  WITH funds_asof AS (
    SELECT * FROM public.get_funds_as_of(p_date) 
    WHERE (asset_class_id = p_asset_class_id OR p_asset_class_id IS NULL)
      AND asset_class_id IS NOT NULL
  ),
  fund_scores AS (
    SELECT 
      f.asset_class_id,
      f.ticker,
      f.perf_date,
      -- Basic scoring using 1-year return as primary metric for now
      CASE 
        WHEN f.one_year_return IS NOT NULL THEN
          LEAST(100, GREATEST(0, 50 + (f.one_year_return - 
            AVG(f.one_year_return) OVER (PARTITION BY f.asset_class_id)) * 5))
        ELSE NULL
      END AS score_final,
      -- Calculate percentile within asset class
      CASE 
        WHEN f.one_year_return IS NOT NULL THEN
          ROUND(PERCENT_RANK() OVER (
            PARTITION BY f.asset_class_id 
            ORDER BY f.one_year_return ASC
          ) * 100)::int
        ELSE NULL
      END AS percentile
    FROM funds_asof f
  )
  SELECT 
    fs.asset_class_id,
    fs.ticker AS fund_ticker,
    fs.perf_date AS date,
    COALESCE(fs.score_final, 50.0) AS score_final,
    fs.percentile
  FROM fund_scores fs
  ORDER BY 
    fs.score_final DESC NULLS LAST, 
    fs.ticker ASC
  LIMIT GREATEST(1, p_limit);
$$;

GRANT EXECUTE ON FUNCTION public.get_scores_as_of(date, uuid, int, text) TO anon, authenticated, service_role;

-- 4. get_compare_dataset - Returns comparison data for selected tickers
CREATE OR REPLACE FUNCTION public.get_compare_dataset(
  p_date date, 
  p_tickers text[]
)
RETURNS TABLE(
  ticker text,
  name text,
  asset_class_id uuid,
  asset_class text,
  ytd_return numeric,
  one_year_return numeric,
  three_year_return numeric,
  five_year_return numeric,
  sharpe_ratio numeric,
  standard_deviation_3y numeric,
  expense_ratio numeric,
  beta numeric,
  benchmark_ticker text,
  benchmark_name text,
  delta_1y numeric
)
LANGUAGE sql
STABLE
AS $$
  WITH funds_asof AS (
    SELECT * FROM public.get_funds_as_of(p_date) 
    WHERE ticker = ANY(p_tickers)
  ),
  primary_bench AS (
    SELECT 
      acb.asset_class_id,
      b.ticker,
      b.name
    FROM public.asset_class_benchmarks acb
    JOIN public.benchmarks b ON b.id = acb.benchmark_id
    WHERE acb.kind = 'primary'
  ),
  bench_1y AS (
    SELECT 
      pb.asset_class_id, 
      pb.ticker AS bench_ticker, 
      pb.name AS bench_name, 
      bpp.one_year_return
    FROM primary_bench pb
    LEFT JOIN LATERAL (
      SELECT * FROM public.benchmark_performance bp
      WHERE bp.benchmark_ticker = pb.ticker 
        AND bp.date <= COALESCE(p_date, public._get_latest_fund_date())
      ORDER BY bp.date DESC
      LIMIT 1
    ) bpp ON true
  )
  SELECT 
    f.ticker, f.name, f.asset_class_id, f.asset_class,
    f.ytd_return, f.one_year_return, f.three_year_return, 
    f.five_year_return, f.sharpe_ratio, f.standard_deviation_3y,
    f.expense_ratio, f.beta,
    b.bench_ticker AS benchmark_ticker, 
    b.bench_name AS benchmark_name,
    CASE 
      WHEN f.one_year_return IS NOT NULL AND b.one_year_return IS NOT NULL
      THEN f.one_year_return - b.one_year_return 
    END AS delta_1y
  FROM funds_asof f
  LEFT JOIN bench_1y b ON b.asset_class_id = f.asset_class_id
  ORDER BY f.ticker ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_compare_dataset(date, text[]) TO anon, authenticated, service_role;

-- 5. get_history_for_tickers - Batched history to eliminate N+1 queries
CREATE OR REPLACE FUNCTION public.get_history_for_tickers(
  p_tickers text[], 
  p_to date DEFAULT NULL
)
RETURNS TABLE(
  fund_ticker text,
  date date,
  ytd_return numeric,
  one_year_return numeric,
  three_year_return numeric
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    fund_ticker, 
    date, 
    ytd_return, 
    one_year_return, 
    three_year_return
  FROM public.fund_performance
  WHERE fund_ticker = ANY(p_tickers)
    AND date <= COALESCE(p_to, public._get_latest_fund_date())
  ORDER BY fund_ticker ASC, date ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_history_for_tickers(text[], date) TO anon, authenticated, service_role;

-- 6. refresh_metric_stats_as_of - Placeholder for future scoring refresh
CREATE OR REPLACE FUNCTION public.refresh_metric_stats_as_of(p_date date)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
VOLATILE
AS $$
  -- Placeholder: This will compute metric statistics when scoring tables are added
  -- For now, just ensure the function exists for the bench harness
  SELECT 1;
$$;

REVOKE ALL ON FUNCTION public.refresh_metric_stats_as_of(date) FROM public;
GRANT EXECUTE ON FUNCTION public.refresh_metric_stats_as_of(date) TO service_role;

-- Rollback instructions:
-- DROP FUNCTION IF EXISTS public.refresh_metric_stats_as_of(date);
-- DROP FUNCTION IF EXISTS public.get_history_for_tickers(text[], date);
-- DROP FUNCTION IF EXISTS public.get_compare_dataset(date, text[]);
-- DROP FUNCTION IF EXISTS public.get_scores_as_of(date, uuid, int, text);
-- DROP FUNCTION IF EXISTS public.get_asset_class_table(date, uuid, boolean);
-- DROP FUNCTION IF EXISTS public.get_active_month(date);
-- DROP FUNCTION IF EXISTS public._get_latest_fund_date();
-- DROP INDEX IF EXISTS idx_acb_primary_unique;