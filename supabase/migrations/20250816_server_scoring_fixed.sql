-- Phase 1: Server-side scoring migration with ALL PostgreSQL syntax errors fixed
-- This migration fixes ALL reserved keyword conflicts, type casting errors, and syntax issues
-- FIXED: Removed record[] parameters which are not allowed in PL/pgSQL

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
CREATE OR REPLACE FUNCTION public._calculate_quantile(sorted_input_values numeric[], q numeric)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  n int;
  k numeric;
  d numeric;
BEGIN
  n := array_length(sorted_input_values, 1);
  IF n = 0 THEN RETURN NULL; END IF;
  
  k := (n - 1) * q;
  d := k - FLOOR(k);
  
  RETURN sorted_input_values[FLOOR(k) + 1] * (1 - d) + sorted_input_values[LEAST(FLOOR(k) + 2, n)] * d;
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

-- Helper function to winsorize Z-score (exactly matches client-side scoring.js) - FIXED: renamed 'limit' to 'winsor_limit'
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
  winsor_limit := SQRT(2) * public._erfinv(2 * p - 1);
  
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
CREATE OR REPLACE FUNCTION public._calculate_robust_scaling_anchors(input_raw_scores numeric[])
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
  sorted_scores := ARRAY(SELECT unnest(input_raw_scores) ORDER BY unnest);
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
CREATE OR REPLACE FUNCTION public._calculate_percentile(raw_score numeric, input_raw_scores numeric[])
RETURNS int
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  better_than_count int := 0;
  score numeric;
BEGIN
  FOREACH score IN ARRAY input_raw_scores
  LOOP
    IF score < raw_score THEN
      better_than_count := better_than_count + 1;
    END IF;
  END LOOP;
  
  RETURN ROUND((better_than_count::numeric / array_length(input_raw_scores, 1)) * 100);
END;
$$;

-- Helper function to calculate metric statistics for a specific asset class and date
CREATE OR REPLACE FUNCTION public._calculate_metric_statistics_for_asset_class(
  p_date date,
  p_asset_class_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  metric_keys text[] := ARRAY['ytd', 'oneYear', 'threeYear', 'fiveYear', 'tenYear', 
                               'sharpeRatio3Y', 'stdDev3Y', 'stdDev5Y', 'upCapture3Y', 
                               'downCapture3Y', 'alpha5Y', 'expenseRatio', 'managerTenure'];
  stats jsonb := '{}'::jsonb;
  metric text;
  metric_values numeric[];
  mean_val numeric;
  stddev_val numeric;
  count_val int;
  coverage numeric;
  q_lo numeric;
  q_hi numeric;
  min_val numeric;
  max_val numeric;
  sorted_metric_values numeric[];
  total_funds int;
BEGIN
  -- Get total count of peer funds (non-benchmarks) for this asset class
  SELECT COUNT(*) INTO total_funds
  FROM public.get_funds_as_of(p_date) f
  WHERE f.asset_class_id = p_asset_class_id 
    AND f.is_benchmark = false;
  
  IF total_funds < 2 THEN
    RETURN stats; -- Not enough funds for meaningful statistics
  END IF;
  
  FOREACH metric IN ARRAY metric_keys
  LOOP
    -- Extract values for this metric from peer funds only
    SELECT array_agg(value) INTO metric_values
    FROM (
      SELECT 
        CASE metric
          WHEN 'ytd' THEN f.ytd_return
          WHEN 'oneYear' THEN f.one_year_return
          WHEN 'threeYear' THEN f.three_year_return
          WHEN 'fiveYear' THEN f.five_year_return
          WHEN 'tenYear' THEN f.ten_year_return
          WHEN 'sharpeRatio3Y' THEN f.sharpe_ratio
          WHEN 'stdDev3Y' THEN f.standard_deviation_3y
          WHEN 'stdDev5Y' THEN f.standard_deviation_5y
          WHEN 'upCapture3Y' THEN f.up_capture_ratio
          WHEN 'downCapture3Y' THEN f.down_capture_ratio
          WHEN 'alpha5Y' THEN f.alpha
          WHEN 'expenseRatio' THEN f.expense_ratio
          WHEN 'managerTenure' THEN f.manager_tenure
        END as value
      FROM public.get_funds_as_of(p_date) f
      WHERE f.asset_class_id = p_asset_class_id 
        AND f.is_benchmark = false
        AND CASE metric
          WHEN 'ytd' THEN f.ytd_return IS NOT NULL
          WHEN 'oneYear' THEN f.one_year_return IS NOT NULL
          WHEN 'threeYear' THEN f.three_year_return IS NOT NULL
          WHEN 'fiveYear' THEN f.five_year_return IS NOT NULL
          WHEN 'tenYear' THEN f.ten_year_return IS NOT NULL
          WHEN 'sharpeRatio3Y' THEN f.sharpe_ratio IS NOT NULL
          WHEN 'stdDev3Y' THEN f.standard_deviation_3y IS NOT NULL
          WHEN 'stdDev5Y' THEN f.standard_deviation_5y IS NOT NULL
          WHEN 'upCapture3Y' THEN f.up_capture_ratio IS NOT NULL
          WHEN 'downCapture3Y' THEN f.down_capture_ratio IS NOT NULL
          WHEN 'alpha5Y' THEN f.alpha IS NOT NULL
          WHEN 'expenseRatio' THEN f.expense_ratio IS NOT NULL
          WHEN 'managerTenure' THEN f.manager_tenure IS NOT NULL
        END
    ) subq;
    
    -- Calculate statistics
    mean_val := public._calculate_mean(metric_values);
    stddev_val := public._calculate_stddev(metric_values, mean_val);
    count_val := array_length(metric_values, 1);
    coverage := CASE WHEN total_funds > 0 
                     THEN count_val::numeric / total_funds::numeric 
                     ELSE 0 END;
    
    -- Calculate quantiles for adaptive winsorization
    q_lo := NULL;
    q_hi := NULL;
    IF count_val >= 20 THEN
      sorted_metric_values := ARRAY(SELECT unnest(metric_values) ORDER BY unnest);
      q_lo := public._calculate_quantile(sorted_metric_values, 0.01);
      q_hi := public._calculate_quantile(sorted_metric_values, 0.99);
    END IF;
    
    -- Find min/max
    min_val := (SELECT MIN(v) FROM unnest(metric_values) v WHERE v IS NOT NULL);
    max_val := (SELECT MAX(v) FROM unnest(metric_values) v WHERE v IS NOT NULL);
    
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
  
  RETURN stats;
END;
$$;

-- Helper function to calculate single fund score (exactly matches client-side) - FIXED VERSION
CREATE OR REPLACE FUNCTION public._calculate_single_fund_score(
  fund_ticker text,
  fund_ytd_return numeric,
  fund_one_year_return numeric,
  fund_three_year_return numeric,
  fund_five_year_return numeric,
  fund_ten_year_return numeric,
  fund_sharpe_ratio numeric,
  fund_standard_deviation_3y numeric,
  fund_standard_deviation_5y numeric,
  fund_up_capture_ratio numeric,
  fund_down_capture_ratio numeric,
  fund_alpha numeric,
  fund_expense_ratio numeric,
  fund_manager_tenure numeric,
  statistics jsonb, 
  weights jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  metric_keys text[] := ARRAY['ytd', 'oneYear', 'threeYear', 'fiveYear', 'tenYear', 
                               'sharpeRatio3Y', 'stdDev3Y', 'stdDev5Y', 'upCapture3Y', 
                               'downCapture3Y', 'alpha5Y', 'expenseRatio', 'managerTenure'];
  breakdown jsonb := '{}'::jsonb;
  weighted_sum numeric := 0;
  observed_peer_counts int[] := ARRAY[]::int[];
  metric text;
  weight numeric;
  value numeric;
  stats jsonb;
  z_score numeric;
  weighted_z_score numeric;
  should_shrink boolean;
  lambda numeric;
  coverage_threshold numeric := 0.4;
  z_shrink_k numeric := 10;
  present_metrics text[] := ARRAY[]::text[];
  total_abs numeric := 0;
  reweighted_sum numeric := 0;
  i int;
BEGIN
  -- Calculate scores for each metric
  FOR i IN 1..array_length(metric_keys, 1)
  LOOP
    metric := metric_keys[i];
    weight := (weights ->> metric)::numeric;
    IF weight IS NULL OR weight = 0 THEN CONTINUE; END IF;
    
    -- Extract metric value from function parameters
    CASE metric
      WHEN 'ytd' THEN value := fund_ytd_return;
      WHEN 'oneYear' THEN value := fund_one_year_return;
      WHEN 'threeYear' THEN value := fund_three_year_return;
      WHEN 'fiveYear' THEN value := fund_five_year_return;
      WHEN 'tenYear' THEN value := fund_ten_year_return;
      WHEN 'sharpeRatio3Y' THEN value := fund_sharpe_ratio;
      WHEN 'stdDev3Y' THEN value := fund_standard_deviation_3y;
      WHEN 'stdDev5Y' THEN value := fund_standard_deviation_5y;
      WHEN 'upCapture3Y' THEN value := fund_up_capture_ratio;
      WHEN 'downCapture3Y' THEN value := fund_down_capture_ratio;
      WHEN 'alpha5Y' THEN value := fund_alpha;
      WHEN 'expenseRatio' THEN value := fund_expense_ratio;
      WHEN 'managerTenure' THEN value := fund_manager_tenure;
    END CASE;
    
    stats := statistics ->> metric;
    IF value IS NOT NULL AND stats IS NOT NULL AND 
       (stats->>'stdDev')::numeric > 0 AND (stats->>'count')::int >= 2 THEN
      
      -- Check coverage threshold
      IF (stats->>'coverage')::numeric < coverage_threshold THEN
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
      observed_peer_counts := array_append(observed_peer_counts, (stats->>'count')::int);
      
      -- Calculate Z-score
      z_score := public._calculate_zscore(
        value, 
        (stats->>'mean')::numeric, 
        (stats->>'stdDev')::numeric
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
        'coverage', (stats->>'coverage')::numeric
      ));
      
      weighted_sum := weighted_sum + weighted_z_score;
    END IF;
  END LOOP;
  
  -- Calculate reweighted sum - FIXED: Proper JSON extraction
  present_metrics := ARRAY(SELECT jsonb_object_keys(breakdown));
  IF array_length(present_metrics, 1) > 0 THEN
    -- FIXED: Extract weight directly from breakdown object, not nested JSON
    total_abs := (SELECT SUM(ABS((breakdown -> m ->> 'weight')::numeric)) 
                  FROM unnest(present_metrics) m);
    
    FOR i IN 1..array_length(present_metrics, 1)
    LOOP
      metric := present_metrics[i];
      -- FIXED: Extract weight and zScore directly from breakdown object
      weight := (breakdown -> metric ->> 'weight')::numeric;
      z_score := (breakdown -> metric ->> 'zScore')::numeric;
      
      IF weight IS NOT NULL AND z_score IS NOT NULL THEN
        lambda := (ABS(weight) / total_abs) * CASE WHEN weight >= 0 THEN 1 ELSE -1 END;
        reweighted_sum := reweighted_sum + (z_score * lambda);
      END IF;
    END LOOP;
  END IF;
  
  -- Return score data
  RETURN jsonb_build_object(
    'raw', weighted_sum,
    'rawReweighted', ROUND(reweighted_sum * 1000) / 1000,
    'breakdown', breakdown,
    'metricsUsed', array_length(present_metrics, 1),
    'totalPossibleMetrics', array_length(metric_keys, 1),
    'peerCountMin', CASE WHEN array_length(observed_peer_counts, 1) > 0 
                         THEN (SELECT MIN(c) FROM unnest(observed_peer_counts) c) 
                         ELSE 0 END
  );
END;
$$;

-- Main scoring function that exactly replicates client-side scoring.js - FIXED VERSION
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
  
  fund_cursor CURSOR FOR
    SELECT f.*
    FROM public.get_funds_as_of(p_date) f
    WHERE (p_asset_class_id IS NULL OR f.asset_class_id = p_asset_class_id)
      AND f.asset_class_id IS NOT NULL;
  
  fund_record record;
  metric_stats jsonb;
  fund_scores jsonb;
  asset_class_name text;
  raw_scores numeric[];
  anchors jsonb;
  i int;
  current_asset_class_id uuid;
  current_asset_class_stats jsonb;
  fund_count int;
  peer_count int;
BEGIN
  -- First, count funds to check if we have enough
  SELECT COUNT(*) INTO fund_count
  FROM public.get_funds_as_of(p_date) f
  WHERE (p_asset_class_id IS NULL OR f.asset_class_id = p_asset_class_id)
    AND f.asset_class_id IS NOT NULL;
  
  IF fund_count < 2 THEN
    -- Return default scores for insufficient funds
    FOR fund_record IN fund_cursor
    LOOP
      asset_class_id := fund_record.asset_class_id;
      ticker := fund_record.ticker;
      name := fund_record.name;
      is_benchmark := fund_record.is_benchmark;
      is_recommended := fund_record.is_recommended;
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
  
  -- Count peer funds (non-benchmarks) for statistics
  SELECT COUNT(*) INTO peer_count
  FROM public.get_funds_as_of(p_date) f
  WHERE (p_asset_class_id IS NULL OR f.asset_class_id = p_asset_class_id)
    AND f.asset_class_id IS NOT NULL
    AND f.is_benchmark = false;
  
  -- Calculate metric statistics for peer funds only (exactly matching client-side)
  metric_stats := public._calculate_metric_statistics_for_asset_class(p_date, p_asset_class_id);
  
  -- Get raw scores for scaling - first pass
  raw_scores := ARRAY[]::numeric[];
  
  -- First pass: collect raw scores
  FOR fund_record IN fund_cursor
  LOOP
    -- Calculate score for this fund
    fund_scores := public._calculate_single_fund_score(
      fund_record.ticker,
      fund_record.ytd_return,
      fund_record.one_year_return,
      fund_record.three_year_return,
      fund_record.five_year_return,
      fund_record.ten_year_return,
      fund_record.sharpe_ratio,
      fund_record.standard_deviation_3y,
      fund_record.standard_deviation_5y,
      fund_record.up_capture_ratio,
      fund_record.down_capture_ratio,
      fund_record.alpha,
      fund_record.expense_ratio,
      fund_record.manager_tenure,
      metric_stats,
      default_weights
    );
    
    -- Add to raw scores array
    raw_scores := array_append(raw_scores, (fund_scores->>'rawReweighted')::numeric);
  END LOOP;
  
  -- Calculate robust scaling anchors if enabled
  IF enable_robust_scaling AND array_length(raw_scores, 1) >= 10 THEN
    anchors := public._calculate_robust_scaling_anchors(raw_scores);
  END IF;
  
  -- Second pass: scale scores and calculate percentiles
  i := 1;
  FOR fund_record IN fund_cursor
  LOOP
    asset_class_id := fund_record.asset_class_id;
    ticker := fund_record.ticker;
    name := fund_record.name;
    is_benchmark := fund_record.is_benchmark;
    is_recommended := fund_record.is_recommended;
    
    -- Recalculate score for this fund
    fund_scores := public._calculate_single_fund_score(
      fund_record.ticker,
      fund_record.ytd_return,
      fund_record.one_year_return,
      fund_record.three_year_return,
      fund_record.five_year_return,
      fund_record.ten_year_return,
      fund_record.sharpe_ratio,
      fund_record.standard_deviation_3y,
      fund_record.standard_deviation_5y,
      fund_record.up_capture_ratio,
      fund_record.down_capture_ratio,
      fund_record.alpha,
      fund_record.expense_ratio,
      fund_record.manager_tenure,
      metric_stats,
      default_weights
    );
    
    -- Get score data
    score_raw := (fund_scores->>'rawReweighted')::numeric;
    metrics_used := (fund_scores->>'metricsUsed')::int;
    total_possible_metrics := (fund_scores->>'totalPossibleMetrics')::int;
    score_breakdown := fund_scores->'breakdown';
    
    -- Apply tiny class fallback if enabled
    IF enable_tiny_class_fallback AND NOT is_benchmark THEN
      score_raw := public._apply_tiny_class_fallback(score_raw, fund_scores);
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
    
    i := i + 1;
  END LOOP;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.calculate_scores_as_of(date, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role; 