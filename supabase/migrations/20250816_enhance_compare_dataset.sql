-- Enhanced Compare Dataset RPC for Sprint 3
-- Supports mixed fund/benchmark selection with proper validation
-- Includes comprehensive performance metrics for comparison

-- Drop the existing function
DROP FUNCTION IF EXISTS public.get_compare_dataset(date, text[]);

-- Create enhanced version with expanded metrics and mixed support
CREATE OR REPLACE FUNCTION public.get_compare_dataset(
  p_date date, 
  p_tickers text[],
  p_benchmark_ticker text DEFAULT NULL -- Optional benchmark selection for deltas
)
RETURNS TABLE(
  ticker text,
  name text,
  asset_class_id uuid,
  asset_class text,
  is_benchmark boolean,
  is_recommended boolean,
  ytd_return numeric,
  one_year_return numeric,
  three_year_return numeric,
  five_year_return numeric,
  ten_year_return numeric,
  sharpe_ratio numeric,
  standard_deviation_3y numeric,
  standard_deviation_5y numeric,
  expense_ratio numeric,
  alpha numeric,
  beta numeric,
  up_capture_ratio numeric,
  down_capture_ratio numeric,
  manager_tenure numeric,
  benchmark_ticker text,
  benchmark_name text,
  delta_ytd numeric,
  delta_1y numeric,
  delta_3y numeric,
  delta_5y numeric,
  peer_count integer
)
LANGUAGE sql
STABLE
AS $$
  WITH 
  -- Limit to max 4 tickers for performance
  limited_tickers AS (
    SELECT UNNEST(p_tickers[1:4]) AS ticker
  ),
  
  -- Get fund data for selected tickers (only if they exist in funds table)
  funds_asof AS (
    SELECT f.*, false as is_benchmark_row
    FROM public.get_funds_as_of(p_date) f
    WHERE f.ticker = ANY(ARRAY(SELECT ticker FROM limited_tickers))
  ),
  
  -- Get benchmark data for selected tickers (only if they exist in benchmarks table)
  benchmarks_asof AS (
    SELECT 
      b.ticker,
      b.name,
      NULL::uuid as asset_class_id,
      'Benchmark'::text as asset_class,
      false as is_recommended,
      bp.ytd_return,
      bp.one_year_return,
      bp.three_year_return,
      bp.five_year_return,
      bp.ten_year_return,
      bp.sharpe_ratio,
      bp.standard_deviation_3y,
      bp.standard_deviation_5y,
      bp.expense_ratio,
      bp.alpha,
      bp.beta,
      bp.up_capture_ratio,
      bp.down_capture_ratio,
      NULL::numeric as manager_tenure,
      bp.standard_deviation,
      bp.date as perf_date,
      true as is_benchmark_row
    FROM public.benchmarks b
    LEFT JOIN LATERAL (
      SELECT * FROM public.benchmark_performance bpf
      WHERE bpf.benchmark_ticker = b.ticker 
        AND bpf.date <= COALESCE(p_date, (SELECT MAX(date) FROM public.benchmark_performance))
      ORDER BY bpf.date DESC
      LIMIT 1
    ) bp ON true
    WHERE b.ticker = ANY(ARRAY(SELECT ticker FROM limited_tickers))
  ),
  
  -- Union funds and benchmarks
  all_items AS (
    SELECT 
      f.ticker, f.name, f.asset_class_id, f.asset_class, f.is_recommended,
      f.ytd_return, f.one_year_return, f.three_year_return, f.five_year_return, f.ten_year_return,
      f.sharpe_ratio, f.standard_deviation_3y, f.standard_deviation_5y, f.expense_ratio,
      f.alpha, f.beta, f.up_capture_ratio, f.down_capture_ratio, f.manager_tenure,
      f.is_benchmark_row as is_benchmark
    FROM funds_asof f
    
    UNION ALL
    
    SELECT 
      b.ticker, b.name, b.asset_class_id, b.asset_class, b.is_recommended,
      b.ytd_return, b.one_year_return, b.three_year_return, b.five_year_return, b.ten_year_return,
      b.sharpe_ratio, b.standard_deviation_3y, b.standard_deviation_5y, b.expense_ratio,
      b.alpha, b.beta, b.up_capture_ratio, b.down_capture_ratio, b.manager_tenure,
      b.is_benchmark_row as is_benchmark
    FROM benchmarks_asof b
  ),
  
  -- Get comparison benchmark (either specified or primary for each asset class)
  comparison_bench AS (
    SELECT 
      COALESCE(ai.asset_class_id, '00000000-0000-0000-0000-000000000000'::uuid) as asset_class_id,
      COALESCE(p_benchmark_ticker, pb.ticker) as bench_ticker,
      COALESCE(
        (SELECT name FROM public.benchmarks WHERE ticker = p_benchmark_ticker),
        pb.name
      ) as bench_name,
      COALESCE(
        (SELECT bp.ytd_return FROM public.benchmark_performance bp 
         WHERE bp.benchmark_ticker = COALESCE(p_benchmark_ticker, pb.ticker)
           AND bp.date <= COALESCE(p_date, (SELECT MAX(date) FROM public.benchmark_performance))
         ORDER BY bp.date DESC LIMIT 1),
        bpp.ytd_return
      ) as bench_ytd,
      COALESCE(
        (SELECT bp.one_year_return FROM public.benchmark_performance bp 
         WHERE bp.benchmark_ticker = COALESCE(p_benchmark_ticker, pb.ticker)
           AND bp.date <= COALESCE(p_date, (SELECT MAX(date) FROM public.benchmark_performance))
         ORDER BY bp.date DESC LIMIT 1),
        bpp.one_year_return
      ) as bench_1y,
      COALESCE(
        (SELECT bp.three_year_return FROM public.benchmark_performance bp 
         WHERE bp.benchmark_ticker = COALESCE(p_benchmark_ticker, pb.ticker)
           AND bp.date <= COALESCE(p_date, (SELECT MAX(date) FROM public.benchmark_performance))
         ORDER BY bp.date DESC LIMIT 1),
        bpp.three_year_return
      ) as bench_3y,
      COALESCE(
        (SELECT bp.five_year_return FROM public.benchmark_performance bp 
         WHERE bp.benchmark_ticker = COALESCE(p_benchmark_ticker, pb.ticker)
           AND bp.date <= COALESCE(p_date, (SELECT MAX(date) FROM public.benchmark_performance))
         ORDER BY bp.date DESC LIMIT 1),
        bpp.five_year_return
      ) as bench_5y
    FROM all_items ai
    LEFT JOIN public.asset_class_benchmarks acb ON acb.asset_class_id = ai.asset_class_id AND acb.kind = 'primary'
    LEFT JOIN public.benchmarks pb ON pb.id = acb.benchmark_id
    LEFT JOIN LATERAL (
      SELECT * FROM public.benchmark_performance bp
      WHERE bp.benchmark_ticker = pb.ticker 
        AND bp.date <= COALESCE(p_date, (SELECT MAX(date) FROM public.benchmark_performance))
      ORDER BY bp.date DESC
      LIMIT 1
    ) bpp ON true
    WHERE ai.asset_class_id IS NOT NULL OR p_benchmark_ticker IS NOT NULL
    GROUP BY ai.asset_class_id, pb.ticker, pb.name, bpp.ytd_return, bpp.one_year_return, bpp.three_year_return, bpp.five_year_return
  ),
  
  -- Calculate peer counts per asset class
  peer_counts AS (
    SELECT 
      ai.asset_class_id,
      COUNT(*) as peer_count
    FROM all_items ai
    WHERE ai.asset_class_id IS NOT NULL AND ai.is_benchmark = false
    GROUP BY ai.asset_class_id
  )
  
  -- Final selection with deltas
  SELECT 
    ai.ticker,
    ai.name,
    ai.asset_class_id,
    ai.asset_class,
    ai.is_benchmark,
    ai.is_recommended,
    ai.ytd_return,
    ai.one_year_return,
    ai.three_year_return,
    ai.five_year_return,
    ai.ten_year_return,
    ai.sharpe_ratio,
    ai.standard_deviation_3y,
    ai.standard_deviation_5y,
    ai.expense_ratio,
    ai.alpha,
    ai.beta,
    ai.up_capture_ratio,
    ai.down_capture_ratio,
    ai.manager_tenure,
    cb.bench_ticker as benchmark_ticker,
    cb.bench_name as benchmark_name,
    CASE 
      WHEN ai.ytd_return IS NOT NULL AND cb.bench_ytd IS NOT NULL AND ai.is_benchmark = false
      THEN ai.ytd_return - cb.bench_ytd 
    END as delta_ytd,
    CASE 
      WHEN ai.one_year_return IS NOT NULL AND cb.bench_1y IS NOT NULL AND ai.is_benchmark = false
      THEN ai.one_year_return - cb.bench_1y 
    END as delta_1y,
    CASE 
      WHEN ai.three_year_return IS NOT NULL AND cb.bench_3y IS NOT NULL AND ai.is_benchmark = false
      THEN ai.three_year_return - cb.bench_3y 
    END as delta_3y,
    CASE 
      WHEN ai.five_year_return IS NOT NULL AND cb.bench_5y IS NOT NULL AND ai.is_benchmark = false
      THEN ai.five_year_return - cb.bench_5y 
    END as delta_5y,
    COALESCE(pc.peer_count, 0) as peer_count
  FROM all_items ai
  LEFT JOIN comparison_bench cb ON (
    ai.asset_class_id = cb.asset_class_id OR 
    (ai.asset_class_id IS NULL AND p_benchmark_ticker IS NOT NULL)
  )
  LEFT JOIN peer_counts pc ON pc.asset_class_id = ai.asset_class_id
  ORDER BY ai.ticker ASC;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_compare_dataset(date, text[], text) TO anon, authenticated, service_role;

-- Create backwards compatible version (no benchmark parameter)
CREATE OR REPLACE FUNCTION public.get_compare_dataset(
  p_date date, 
  p_tickers text[]
)
RETURNS TABLE(
  ticker text,
  name text,
  asset_class_id uuid,
  asset_class text,
  is_benchmark boolean,
  is_recommended boolean,
  ytd_return numeric,
  one_year_return numeric,
  three_year_return numeric,
  five_year_return numeric,
  ten_year_return numeric,
  sharpe_ratio numeric,
  standard_deviation_3y numeric,
  standard_deviation_5y numeric,
  expense_ratio numeric,
  alpha numeric,
  beta numeric,
  up_capture_ratio numeric,
  down_capture_ratio numeric,
  manager_tenure numeric,
  benchmark_ticker text,
  benchmark_name text,
  delta_ytd numeric,
  delta_1y numeric,
  delta_3y numeric,
  delta_5y numeric,
  peer_count integer
)
LANGUAGE sql
STABLE
AS $$
  SELECT * FROM public.get_compare_dataset(p_date, p_tickers, NULL::text);
$$;

GRANT EXECUTE ON FUNCTION public.get_compare_dataset(date, text[]) TO anon, authenticated, service_role;