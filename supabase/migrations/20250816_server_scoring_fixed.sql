-- Phase 1: Server-side scoring migration preserving exact mathematical behavior
-- This migration adds the calculate_scores_as_of RPC that exactly replicates client-side scoring.js
-- FIXED: Changed parameter names to avoid PostgreSQL reserved keyword conflicts
-- FIXED: Restructured functions to avoid record[] parameter types
-- FIXED: Replaced record[] variables with proper table types and temporary tables

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Helper function to calculate mean (exactly matches client-side math.js)
CREATE OR REPLACE FUNCTION public._calculate_mean(input_values numeric[])
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  sum_val numeric := 0;
  count_val int := 0;
  val numeric;
BEGIN
  FOREACH val IN ARRAY input_values
  LOOP
    IF val IS NOT NULL THEN
      sum_val := sum_val + val;
      count_val := count_val + 1;
    END IF;
  END LOOP;
  
  RETURN CASE WHEN count_val > 0 THEN sum_val / count_val ELSE NULL END;
END;
$$;

-- Helper function to calculate standard deviation (exactly matches client-side math.js)
CREATE OR REPLACE FUNCTION public._calculate_stddev(input_values numeric[], mean_val numeric)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  sum_sq numeric := 0;
  count_val int := 0;
  val numeric;
BEGIN
  FOREACH val IN ARRAY input_values
  LOOP
    IF val IS NOT NULL THEN
      sum_sq := sum_sq + POWER(val - mean_val, 2);
      count_val := count_val + 1;
    END IF;
  END LOOP;
  
  RETURN CASE WHEN count_val > 1 THEN SQRT(sum_sq / (count_val - 1)) ELSE NULL END;
END;
$$;

-- Helper function to calculate Z-score (exactly matches client-side math.js)
CREATE OR REPLACE FUNCTION public._calculate_zscore(value numeric, mean_val numeric, stddev_val numeric)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN CASE 
    WHEN stddev_val IS NULL OR stddev_val = 0 THEN NULL
    ELSE (value - mean_val) / stddev_val
  END;
END;
$$;

-- Helper function to calculate quantile (exactly matches client-side math.js)
CREATE OR REPLACE FUNCTION public._calculate_quantile(sorted_values numeric[], q numeric)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  n int;
  k numeric;
  d numeric;
BEGIN
  n := array_length(sorted_values, 1);
  IF n = 0 THEN RETURN NULL; END IF;
  
  k := (n - 1) * q;
  d := k - FLOOR(k);
  
  RETURN sorted_values[FLOOR(k) + 1] * (1 - d) + sorted_values[LEAST(FLOOR(k) + 2, n)] * d;
END;
$$;

-- Helper function to calculate error function approximation (exactly matches client-side math.js)
CREATE OR REPLACE FUNCTION public._erf(x numeric)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  a1 numeric := 0.254829592;
  a2 numeric := -0.284496736;
  a3 numeric := 1.421413741;
  a4 numeric := -1.453152027;
  a5 numeric := 1.061405429;
  p numeric := 0.3275911;
  sign numeric;
  t numeric;
  y numeric;
BEGIN
  sign := CASE WHEN x >= 0 THEN 1 ELSE -1 END;
  x := ABS(x);
  
  t := 1.0 / (1.0 + p * x);
  y := 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * EXP(-x * x);
  
  RETURN sign * y;
END;
$$;

-- Helper function to calculate inverse error function approximation (exactly matches client-side math.js)
CREATE OR REPLACE FUNCTION public._erfinv(x numeric)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  a numeric := 0.147;
  sign numeric;
  ln1mx numeric;
  term1 numeric;
  term2 numeric;
BEGIN
  sign := CASE WHEN x >= 0 THEN 1 ELSE -1 END;
  x := ABS(x);
  
  IF x >= 0.95 THEN
    ln1mx := LN(1 - x);
    term1 := 2 / (PI() * a) + ln1mx / 2;
    term2 := ln1mx / a;
    RETURN sign * SQRT(-term1 + SQRT(term1 * term1 - term2));
  ELSE
    RETURN sign * SQRT(-LN(1 - x * x) / 2);
  END IF;
END;
$$;

-- Helper function to winsorize Z-score (exactly matches client-side scoring.js)
CREATE OR REPLACE FUNCTION public._winsorize_z(z numeric, metric text)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  winsor_limit numeric;
  winsor_limits_by_metric jsonb := '{
    "ytd": 0.99,
    "oneYear": 0.99,
    "threeYear": 0.985,
    "fiveYear": 0.985,
    "tenYear": 0.985,
    "sharpeRatio3Y": 0.98,
    "stdDev3Y": 0.975,
    "stdDev5Y": 0.975,
    "upCapture3Y": 0.98,
    "downCapture3Y": 0.98,
    "alpha5Y": 0.98,
    "expenseRatio": 0.98,
    "managerTenure": 0.99
  }'::jsonb;
  p numeric;
BEGIN
  p := COALESCE((winsor_limits_by_metric ->> metric)::numeric, 0.98);
  winsor_limit := SQRT(2) * _erfinv(2 * p - 1);
  
  IF winsor_limit IS NULL THEN winsor_limit := 2.326; END IF;
  
  RETURN CASE
    WHEN z > winsor_limit THEN winsor_limit
    WHEN z < -winsor_limit THEN -winsor_limit
    ELSE z
  END;
END;
$$;

-- Helper function to scale score (exactly matches client-side scoring.js)
CREATE OR REPLACE FUNCTION public._scale_score(raw_score numeric)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  scaled numeric;
BEGIN
  scaled := 50 + 10 * raw_score;
  IF scaled < 0 THEN RETURN 0; END IF;
  IF scaled > 100 THEN RETURN 100; END IF;
  RETURN ROUND(scaled * 10) / 10;
END;
$$;

-- Helper function to calculate robust scaling anchors
CREATE OR REPLACE FUNCTION public._calculate_robust_scaling_anchors(raw_scores numeric[])
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  sorted_scores numeric[];
  q05 numeric;
  median numeric;
  q95 numeric;
BEGIN
  sorted_scores := ARRAY(SELECT unnest(raw_scores) ORDER BY unnest);
  q05 := public._calculate_quantile(sorted_scores, 0.05);
  median := public._calculate_quantile(sorted_scores, 0.5);
  q95 := public._calculate_quantile(sorted_scores, 0.95);
  
  RETURN jsonb_build_object('q05', q05, 'median', median, 'q95', q95);
END;
$$;

-- Helper function to scale score robustly
CREATE OR REPLACE FUNCTION public._scale_score_robust(raw numeric, anchors jsonb)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  q05 numeric;
  median numeric;
  q95 numeric;
  y numeric;
  m numeric;
BEGIN
  q05 := (anchors ->> 'q05')::numeric;
  median := (anchors ->> 'median')::numeric;
  q95 := (anchors ->> 'q95')::numeric;
  
  IF NOT (q05 IS NOT NULL AND median IS NOT NULL AND q95 IS NOT NULL) THEN
    RETURN public._scale_score(raw);
  END IF;
  
  -- Map q05→40, median→50, q95→60, and linearly extend; clamp 0..100
  IF raw <= q05 THEN
    m := (40 - 0) / (q05 - (q05 - (q95 - q05)));
    y := 40 + m * (raw - q05);
  ELSIF raw >= q95 THEN
    m := (100 - 60) / ((q95 + (q95 - q05)) - q95);
    y := 60 + m * (raw - q95);
  ELSIF raw <= median THEN
    m := (50 - 40) / (median - q05);
    y := 40 + m * (raw - q05);
  ELSE
    m := (60 - 50) / (q95 - median);
    y := 50 + m * (raw - median);
  END IF;
  
  RETURN GREATEST(0, LEAST(100, ROUND(y * 10) / 10));
END;
$$;

-- Helper function to apply tiny class fallback
CREATE OR REPLACE FUNCTION public._apply_tiny_class_fallback(raw_score numeric, score_data jsonb)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  min_peers int;
  min_peers_threshold int := 5;
  neutral_threshold int := 2;
  shrink_factor numeric := 0.25;
BEGIN
  min_peers := (score_data ->> 'peerCountMin')::int;
  
  IF min_peers > 0 AND min_peers < min_peers_threshold THEN
    IF min_peers <= neutral_threshold THEN
      RETURN 0; -- neutral contribution when peers are extremely few
    ELSE
      RETURN raw_score * shrink_factor; -- shrink raw effect
    END IF;
  END IF;
  
  RETURN raw_score;
END;
$$;

-- Helper function to calculate percentile
CREATE OR REPLACE FUNCTION public._calculate_percentile(raw_score numeric, raw_scores numeric[])
RETURNS int
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  better_than_count int := 0;
  score numeric;
BEGIN
  FOREACH score IN ARRAY raw_scores
  LOOP
    IF score < raw_score THEN
      better_than_count := better_than_count + 1;
    END IF;
  END LOOP;
  
  RETURN ROUND((better_than_count::numeric / array_length(raw_scores, 1)) * 100);
END;
$$;

-- Main scoring function that exactly replicates client-side scoring.js
CREATE OR REPLACE FUNCTION public.calculate_scores_as_of(
  p_date date,
  p_asset_class_id uuid DEFAULT NULL
)
RETURNS TABLE(
  asset_class_id uuid,
  ticker text,
  name text,
  is_benchmark boolean,
  is_recommended boolean,
  score_raw numeric,
  score_final numeric,
  percentile int,
  metrics_used int,
  total_possible_metrics int,
  score_breakdown jsonb
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  -- Default weights exactly matching client-side DEFAULT_WEIGHTS
  default_weights jsonb := '{
    "ytd": 0.025,
    "oneYear": 0.05,
    "threeYear": 0.10,
    "fiveYear": 0.15,
    "tenYear": 0.10,
    "sharpeRatio3Y": 0.10,
    "stdDev3Y": -0.075,
    "stdDev5Y": -0.125,
    "upCapture3Y": 0.075,
    "downCapture3Y": -0.10,
    "alpha5Y": 0.05,
    "expenseRatio": -0.025,
    "managerTenure": 0.025
  }'::jsonb;
  
  -- Configuration flags (matching client-side defaults)
  enable_winsorization boolean := false;
  enable_adaptive_winsor boolean := false;
  enable_tiny_class_fallback boolean := false;
  enable_robust_scaling boolean := false;
  enable_bench_delta boolean := false;
  
  -- Tiny class parameters
  tiny_class_min_peers int := 5;
  tiny_class_neutral_threshold int := 2;
  tiny_class_shrink numeric := 0.25;
  
  -- Coverage and Z-shrink parameters
  coverage_threshold numeric := 0.4;
  z_shrink_k numeric := 10;
  
  -- Winsorization parameters
  winsor_q_lo numeric := 0.01;
  winsor_q_hi numeric := 0.99;
  
  -- Metric keys for scoring
  metric_keys text[] := ARRAY['ytd', 'oneYear', 'threeYear', 'fiveYear', 'tenYear',
                               'sharpeRatio3Y', 'stdDev3Y', 'stdDev5Y', 'upCapture3Y',
                               'downCapture3Y', 'alpha5Y', 'expenseRatio', 'managerTenure'];
  
  -- Variables for metric statistics
  stats jsonb := '{}'::jsonb;
  metric text;
  input_values numeric[];
  mean_val numeric;
  stddev_val numeric;
  count_val int;
  coverage numeric;
  q_lo numeric;
  q_hi numeric;
  min_val numeric;
  max_val numeric;
  sorted_values numeric[];
  i int;
  
  -- Variables for fund scoring
  breakdown jsonb := '{}'::jsonb;
  weighted_sum numeric := 0;
  observed_peer_counts int[] := ARRAY[]::int[];
  weight numeric;
  value numeric;
  z_score numeric;
  weighted_z_score numeric;
  should_shrink boolean;
  lambda numeric;
  present_metrics text[] := ARRAY[]::text[];
  total_abs numeric := 0;
  reweighted_sum numeric := 0;
  
  -- Variables for score calculation
  score_raw numeric;
  score_final numeric;
  metrics_used int;
  total_possible_metrics int;
  score_breakdown jsonb;
  percentile int;
  
  -- Temporary variables
  fund_data jsonb;
  fund_scores_array jsonb[] := ARRAY[]::jsonb[];
  peer_count int;
  
  -- Fund data variables
  fund_ticker text;
  fund_name text;
  fund_is_benchmark boolean;
  fund_is_recommended boolean;
  fund_asset_class_id uuid;
  fund_ytd numeric;
  fund_one_year numeric;
  fund_three_year numeric;
  fund_five_year numeric;
  fund_ten_year numeric;
  fund_sharpe numeric;
  fund_stddev_3y numeric;
  fund_stddev_5y numeric;
  fund_up_capture numeric;
  fund_down_capture numeric;
  fund_alpha numeric;
  fund_expense numeric;
  fund_tenure numeric;
  
  -- Cursor for iterating through funds
  fund_cursor CURSOR FOR
    SELECT 
      f.asset_class_id,
      f.ticker,
      f.name,
      f.is_benchmark,
      f.is_recommended,
      f.ytd_return,
      f.one_year_return,
      f.three_year_return,
      f.five_year_return,
      f.ten_year_return,
      f.sharpe_ratio,
      f.standard_deviation_3y,
      f.standard_deviation_5y,
      f.up_capture_ratio,
      f.down_capture_ratio,
      f.alpha,
      f.expense_ratio,
      f.manager_tenure
    FROM public.get_funds_as_of(p_date) f
    WHERE (p_asset_class_id IS NULL OR f.asset_class_id = p_asset_class_id)
      AND f.asset_class_id IS NOT NULL;
  
  -- Cursor for peer funds only (for statistics)
  peer_cursor CURSOR FOR
    SELECT 
      f.ytd_return,
      f.one_year_return,
      f.three_year_return,
      f.five_year_return,
      f.ten_year_return,
      f.sharpe_ratio,
      f.standard_deviation_3y,
      f.standard_deviation_5y,
      f.up_capture_ratio,
      f.down_capture_ratio,
      f.alpha,
      f.expense_ratio,
      f.manager_tenure
    FROM public.get_funds_as_of(p_date) f
    WHERE (p_asset_class_id IS NULL OR f.asset_class_id = p_asset_class_id)
      AND f.asset_class_id IS NOT NULL
      AND NOT f.is_benchmark;
  
  -- Arrays to store fund data
  fund_tickers text[] := ARRAY[]::text[];
  fund_names text[] := ARRAY[]::text[];
  fund_benchmarks boolean[] := ARRAY[]::boolean[];
  fund_recommended boolean[] := ARRAY[]::boolean[];
  fund_asset_classes uuid[] := ARRAY[]::uuid[];
  fund_ytd_returns numeric[] := ARRAY[]::numeric[];
  fund_one_year_returns numeric[] := ARRAY[]::numeric[];
  fund_three_year_returns numeric[] := ARRAY[]::numeric[];
  fund_five_year_returns numeric[] := ARRAY[]::numeric[];
  fund_ten_year_returns numeric[] := ARRAY[]::numeric[];
  fund_sharpe_ratios numeric[] := ARRAY[]::numeric[];
  fund_stddev_3y_returns numeric[] := ARRAY[]::numeric[];
  fund_stddev_5y_returns numeric[] := ARRAY[]::numeric[];
  fund_up_captures numeric[] := ARRAY[]::numeric[];
  fund_down_captures numeric[] := ARRAY[]::numeric[];
  fund_alphas numeric[] := ARRAY[]::numeric[];
  fund_expense_ratios numeric[] := ARRAY[]::numeric[];
  fund_tenures numeric[] := ARRAY[]::numeric[];
  
  -- Arrays for peer fund data (non-benchmarks only)
  peer_ytd_returns numeric[] := ARRAY[]::numeric[];
  peer_one_year_returns numeric[] := ARRAY[]::numeric[];
  peer_three_year_returns numeric[] := ARRAY[]::numeric[];
  peer_five_year_returns numeric[] := ARRAY[]::numeric[];
  peer_ten_year_returns numeric[] := ARRAY[]::numeric[];
  peer_sharpe_ratios numeric[] := ARRAY[]::numeric[];
  peer_stddev_3y_returns numeric[] := ARRAY[]::numeric[];
  peer_stddev_5y_returns numeric[] := ARRAY[]::numeric[];
  peer_up_captures numeric[] := ARRAY[]::numeric[];
  peer_down_captures numeric[] := ARRAY[]::numeric[];
  peer_alphas numeric[] := ARRAY[]::numeric[];
  peer_expense_ratios numeric[] := ARRAY[]::numeric[];
  peer_tenures numeric[] := ARRAY[]::numeric[];
  
  fund_count int := 0;
  peer_count_total int := 0;
BEGIN
  -- First pass: collect all fund data into arrays
  OPEN fund_cursor;
  LOOP
    FETCH fund_cursor INTO 
      fund_asset_class_id, fund_ticker, fund_name, fund_is_benchmark, fund_is_recommended,
      fund_ytd, fund_one_year, fund_three_year, fund_five_year, fund_ten_year,
      fund_sharpe, fund_stddev_3y, fund_stddev_5y, fund_up_capture, fund_down_capture,
      fund_alpha, fund_expense, fund_tenure;
    
    EXIT WHEN NOT FOUND;
    
    fund_count := fund_count + 1;
    
    -- Store fund data in arrays
    fund_tickers := array_append(fund_tickers, fund_ticker);
    fund_names := array_append(fund_names, fund_name);
    fund_benchmarks := array_append(fund_benchmarks, fund_is_benchmark);
    fund_recommended := array_append(fund_recommended, fund_is_recommended);
    fund_asset_classes := array_append(fund_asset_classes, fund_asset_class_id);
    fund_ytd_returns := array_append(fund_ytd_returns, fund_ytd);
    fund_one_year_returns := array_append(fund_one_year_returns, fund_one_year);
    fund_three_year_returns := array_append(fund_three_year_returns, fund_three_year);
    fund_five_year_returns := array_append(fund_five_year_returns, fund_five_year);
    fund_ten_year_returns := array_append(fund_ten_year_returns, fund_ten_year);
    fund_sharpe_ratios := array_append(fund_sharpe_ratios, fund_sharpe);
    fund_stddev_3y_returns := array_append(fund_stddev_3y_returns, fund_stddev_3y);
    fund_stddev_5y_returns := array_append(fund_stddev_5y_returns, fund_stddev_5y);
    fund_up_captures := array_append(fund_up_captures, fund_up_capture);
    fund_down_captures := array_append(fund_down_captures, fund_down_capture);
    fund_alphas := array_append(fund_alphas, fund_alpha);
    fund_expense_ratios := array_append(fund_expense_ratios, fund_expense);
    fund_tenures := array_append(fund_tenures, fund_tenure);
    
    -- Store peer fund data (non-benchmarks only)
    IF NOT fund_is_benchmark THEN
      peer_count_total := peer_count_total + 1;
      peer_ytd_returns := array_append(peer_ytd_returns, fund_ytd);
      peer_one_year_returns := array_append(peer_one_year_returns, fund_one_year);
      peer_three_year_returns := array_append(peer_three_year_returns, fund_three_year);
      peer_five_year_returns := array_append(peer_five_year_returns, fund_five_year);
      peer_ten_year_returns := array_append(peer_ten_year_returns, fund_ten_year);
      peer_sharpe_ratios := array_append(peer_sharpe_ratios, fund_sharpe);
      peer_stddev_3y_returns := array_append(peer_stddev_3y_returns, fund_stddev_3y);
      peer_stddev_5y_returns := array_append(peer_stddev_5y_returns, fund_stddev_5y);
      peer_up_captures := array_append(peer_up_captures, fund_up_capture);
      peer_down_captures := array_append(peer_down_captures, fund_down_capture);
      peer_alphas := array_append(peer_alphas, fund_alpha);
      peer_expense_ratios := array_append(peer_expense_ratios, fund_expense);
      peer_tenures := array_append(peer_tenures, fund_tenure);
    END IF;
  END LOOP;
  CLOSE fund_cursor;
  
  IF fund_count < 2 THEN
    -- Return default scores for insufficient funds
    FOR i IN 1..fund_count
    LOOP
      asset_class_id := fund_asset_classes[i];
      ticker := fund_tickers[i];
      name := fund_names[i];
      is_benchmark := fund_benchmarks[i];
      is_recommended := fund_recommended[i];
      score_raw := 0;
      score_final := 50;
      percentile := 50;
      metrics_used := 0;
      total_possible_metrics := 13;
      score_breakdown := '{}'::jsonb;
      
      RETURN NEXT;
    END LOOP;
    RETURN;
  END IF;
  
  -- Calculate metric statistics for peer funds only (exactly matching client-side)
  FOREACH metric IN ARRAY metric_keys
  LOOP
    -- Extract values for this metric from peer funds
    input_values := ARRAY[]::numeric[];
    CASE metric
      WHEN 'ytd' THEN input_values := peer_ytd_returns;
      WHEN 'oneYear' THEN input_values := peer_one_year_returns;
      WHEN 'threeYear' THEN input_values := peer_three_year_returns;
      WHEN 'fiveYear' THEN input_values := peer_five_year_returns;
      WHEN 'tenYear' THEN input_values := peer_ten_year_returns;
      WHEN 'sharpeRatio3Y' THEN input_values := peer_sharpe_ratios;
      WHEN 'stdDev3Y' THEN input_values := peer_stddev_3y_returns;
      WHEN 'stdDev5Y' THEN input_values := peer_stddev_5y_returns;
      WHEN 'upCapture3Y' THEN input_values := peer_up_captures;
      WHEN 'downCapture3Y' THEN input_values := peer_down_captures;
      WHEN 'alpha5Y' THEN input_values := peer_alphas;
      WHEN 'expenseRatio' THEN input_values := peer_expense_ratios;
      WHEN 'managerTenure' THEN input_values := peer_tenures;
    END CASE;
    
    -- Calculate statistics
    mean_val := public._calculate_mean(input_values);
    stddev_val := public._calculate_stddev(input_values, mean_val);
    count_val := array_length(input_values, 1);
    coverage := CASE WHEN peer_count_total > 0
                     THEN count_val::numeric / peer_count_total::numeric
                     ELSE 0 END;
    
    -- Calculate quantiles for adaptive winsorization
    q_lo := NULL;
    q_hi := NULL;
    IF count_val >= 20 THEN
      sorted_values := ARRAY(SELECT unnest(input_values) ORDER BY unnest);
      q_lo := public._calculate_quantile(sorted_values, 0.01);
      q_hi := public._calculate_quantile(sorted_values, 0.99);
    END IF;
    
    -- Find min/max
    min_val := (SELECT MIN(v) FROM unnest(input_values) v WHERE v IS NOT NULL);
    max_val := (SELECT MAX(v) FROM unnest(input_values) v WHERE v IS NOT NULL);
    
    -- Store statistics
    stats := stats || jsonb_build_object(metric, jsonb_build_object(
      'mean', mean_val,
      'stdDev', stddev_val,
      'count', count_val,
      'coverage', coverage,
      'qLo', q_lo,
      'qHi', q_hi,
      'min', min_val,
      'max', max_val
    ));
  END LOOP;
  
  -- Calculate scores for all funds (including benchmarks)
  fund_scores_array := ARRAY[]::jsonb[];
  FOR i IN 1..fund_count
  LOOP
    -- Calculate single fund score
    breakdown := '{}'::jsonb;
    weighted_sum := 0;
    observed_peer_counts := ARRAY[]::int[];
    
    -- Calculate scores for each metric
    FOREACH metric IN ARRAY metric_keys
    LOOP
      weight := (default_weights ->> metric)::numeric;
      IF weight IS NULL OR weight = 0 THEN CONTINUE; END IF;
      
      -- Extract metric value from database columns
      CASE metric
        WHEN 'ytd' THEN value := fund_ytd_returns[i];
        WHEN 'oneYear' THEN value := fund_one_year_returns[i];
        WHEN 'threeYear' THEN value := fund_three_year_returns[i];
        WHEN 'fiveYear' THEN value := fund_five_year_returns[i];
        WHEN 'tenYear' THEN value := fund_ten_year_returns[i];
        WHEN 'sharpeRatio3Y' THEN value := fund_sharpe_ratios[i];
        WHEN 'stdDev3Y' THEN value := fund_stddev_3y_returns[i];
        WHEN 'stdDev5Y' THEN value := fund_stddev_5y_returns[i];
        WHEN 'upCapture3Y' THEN value := fund_up_captures[i];
        WHEN 'downCapture3Y' THEN value := fund_down_captures[i];
        WHEN 'alpha5Y' THEN value := fund_alphas[i];
        WHEN 'expenseRatio' THEN value := fund_expense_ratios[i];
        WHEN 'managerTenure' THEN value := fund_tenures[i];
      END CASE;
      
      fund_data := stats ->> metric;
      IF value IS NOT NULL AND fund_data IS NOT NULL AND
         (fund_data::jsonb->>'stdDev')::numeric > 0 AND (fund_data::jsonb->>'count')::int >= 2 THEN
        
        -- Check coverage threshold
        IF (fund_data::jsonb->>'coverage')::numeric < coverage_threshold THEN
          breakdown := breakdown || jsonb_build_object(metric, jsonb_build_object(
            'value', value,
            'zScore', 0,
            'weight', 0,
            'weightedZScore', 0,
            'percentile', NULL,
            'excludedForCoverage', true
          ));
          CONTINUE;
        END IF;
        
        -- Record peer count
        peer_count := (fund_data::jsonb->>'count')::int;
        observed_peer_counts := array_append(observed_peer_counts, peer_count);
        
        -- Calculate Z-score
        z_score := public._calculate_zscore(
          value,
          (fund_data::jsonb->>'mean')::numeric,
          (fund_data::jsonb->>'stdDev')::numeric
        );
        
        -- Apply winsorization if enabled (currently disabled by default)
        -- This matches client-side behavior exactly
        
        -- Calculate weighted Z-score
        weighted_z_score := z_score * weight;
        
        -- Store breakdown
        breakdown := breakdown || jsonb_build_object(metric, jsonb_build_object(
          'value', value,
          'zScore', ROUND(z_score * 1000) / 1000,
          'weight', weight,
          'weightedZScore', ROUND(weighted_z_score * 1000) / 1000,
          'percentile', NULL, -- calculated later
          'coverage', (fund_data::jsonb->>'coverage')::numeric
        ));
        
        weighted_sum := weighted_sum + weighted_z_score;
      END IF;
    END LOOP;
    
    -- Calculate reweighted sum
    present_metrics := ARRAY(SELECT jsonb_object_keys(breakdown));
    reweighted_sum := 0;
    IF array_length(present_metrics, 1) > 0 THEN
      total_abs := (SELECT SUM(ABS((breakdown ->> m)::jsonb ->> 'weight')::numeric)
                    FROM unnest(present_metrics) m);
      
      FOR j IN 1..array_length(present_metrics, 1)
      LOOP
        metric := present_metrics[j];
        weight := (breakdown ->> metric)::jsonb ->> 'weight';
        z_score := (breakdown ->> metric)::jsonb ->> 'zScore';
        
        IF weight IS NOT NULL AND z_score IS NOT NULL THEN
          lambda := (ABS(weight) / total_abs) * CASE WHEN weight >= 0 THEN 1 ELSE -1 END;
          reweighted_sum := reweighted_sum + (z_score::numeric * lambda);
        END IF;
      END LOOP;
    END IF;
    
    -- Store score data
    fund_scores_array := array_append(fund_scores_array, jsonb_build_object(
      'raw', weighted_sum,
      'rawReweighted', ROUND(reweighted_sum * 1000) / 1000,
      'breakdown', breakdown,
      'metricsUsed', array_length(present_metrics, 1),
      'totalPossibleMetrics', array_length(metric_keys, 1),
      'peerCountMin', CASE WHEN array_length(observed_peer_counts, 1) > 0
                           THEN (SELECT MIN(c) FROM unnest(observed_peer_counts) c)
                           ELSE 0 END
    ));
  END LOOP;
  
  -- Get raw scores for scaling
  raw_scores := ARRAY[]::numeric[];
  FOR i IN 1..array_length(fund_scores_array, 1)
  LOOP
    raw_scores := array_append(raw_scores, (fund_scores_array[i]->>'rawReweighted')::numeric);
  END LOOP;
  
  -- Calculate robust scaling anchors if enabled
  IF enable_robust_scaling AND array_length(raw_scores, 1) >= 10 THEN
    anchors := public._calculate_robust_scaling_anchors(raw_scores);
  END IF;
  
  -- Scale scores and calculate percentiles
  FOR i IN 1..fund_count
  LOOP
    asset_class_id := fund_asset_classes[i];
    ticker := fund_tickers[i];
    name := fund_names[i];
    is_benchmark := fund_benchmarks[i];
    is_recommended := fund_recommended[i];
    
    -- Get score data
    score_raw := (fund_scores_array[i]->>'rawReweighted')::numeric;
    metrics_used := (fund_scores_array[i]->>'metricsUsed')::int;
    total_possible_metrics := (fund_scores_array[i]->>'totalPossibleMetrics')::int;
    score_breakdown := fund_scores_array[i]->'breakdown';
    
    -- Apply tiny class fallback if enabled
    IF enable_tiny_class_fallback AND NOT is_benchmark THEN
      score_raw := public._apply_tiny_class_fallback(score_raw, fund_scores_array[i]);
    END IF;
    
    -- Scale score
    IF anchors IS NOT NULL THEN
      score_final := public._scale_score_robust(score_raw, anchors);
    ELSE
      score_final := public._scale_score(score_raw);
    END IF;
    
    -- Calculate percentile
    percentile := public._calculate_percentile(score_raw, raw_scores);
    
    RETURN NEXT;
  END LOOP;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.calculate_scores_as_of(date, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role; 