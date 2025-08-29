-- Deploy Fixed Server-Side Scoring Function
-- This script fixes the ABS(text) error and other JSON type casting issues

-- Step 1: Drop the problematic function first
DROP FUNCTION IF EXISTS public.calculate_scores_as_of(date, uuid);
DROP FUNCTION IF EXISTS public.calculate_scores_as_of(date, uuid, boolean);
DROP FUNCTION IF EXISTS public._calculate_single_fund_score(record, jsonb, jsonb);
DROP FUNCTION IF EXISTS public._calculate_fund_scores(record[], jsonb, jsonb);
DROP FUNCTION IF EXISTS public._calculate_metric_statistics(record[]);

-- Step 2: Recreate the helper functions with proper type handling
CREATE OR REPLACE FUNCTION public._calculate_metric_statistics(peer_funds record[])
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
  values numeric[];
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
  fund record;
BEGIN
  FOREACH metric IN ARRAY metric_keys
  LOOP
    -- Extract values for this metric
    values := ARRAY[]::numeric[];
    FOR i IN 1..array_length(peer_funds, 1)
    LOOP
      fund := peer_funds[i];
      -- Map metric names to actual database columns
      CASE metric
        WHEN 'ytd' THEN values := array_append(values, fund.ytd_return);
        WHEN 'oneYear' THEN values := array_append(values, fund.one_year_return);
        WHEN 'threeYear' THEN values := array_append(values, fund.three_year_return);
        WHEN 'fiveYear' THEN values := array_append(values, fund.five_year_return);
        WHEN 'tenYear' THEN values := array_append(values, fund.ten_year_return);
        WHEN 'sharpeRatio3Y' THEN values := array_append(values, fund.sharpe_ratio);
        WHEN 'stdDev3Y' THEN values := array_append(values, fund.standard_deviation_3y);
        WHEN 'stdDev5Y' THEN values := array_append(values, fund.standard_deviation_5y);
        WHEN 'upCapture3Y' THEN values := array_append(values, fund.up_capture_ratio);
        WHEN 'downCapture3Y' THEN values := array_append(values, fund.down_capture_ratio);
        WHEN 'alpha5Y' THEN values := array_append(values, fund.alpha);
        WHEN 'expenseRatio' THEN values := array_append(values, fund.expense_ratio);
        WHEN 'managerTenure' THEN values := array_append(values, fund.manager_tenure);
      END CASE;
    END LOOP;
    
    -- Calculate statistics
    mean_val := public._calculate_mean(values);
    stddev_val := public._calculate_stddev(values, mean_val);
    count_val := array_length(values, 1);
    coverage := CASE WHEN array_length(peer_funds, 1) > 0 
                     THEN count_val::numeric / array_length(peer_funds, 1)::numeric 
                     ELSE 0 END;
    
    -- Calculate quantiles for adaptive winsorization
    q_lo := NULL;
    q_hi := NULL;
    IF count_val >= 20 THEN
      sorted_values := ARRAY(SELECT unnest(values) ORDER BY unnest);
      q_lo := public._calculate_quantile(sorted_values, 0.01);
      q_hi := public._calculate_quantile(sorted_values, 0.99);
    END IF;
    
    -- Find min/max
    min_val := (SELECT MIN(v) FROM unnest(values) v WHERE v IS NOT NULL);
    max_val := (SELECT MAX(v) FROM unnest(values) v WHERE v IS NOT NULL);
    
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

-- Step 3: Recreate the fund scores calculation function
CREATE OR REPLACE FUNCTION public._calculate_fund_scores(
  funds record[], 
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
  scores jsonb := '[]'::jsonb;
  fund record;
  score_data jsonb;
  i int;
BEGIN
  FOR i IN 1..array_length(funds, 1)
  LOOP
    fund := funds[i];
    score_data := public._calculate_single_fund_score(fund, statistics, weights);
    scores := scores || score_data;
  END LOOP;
  
  RETURN scores;
END;
$$;

-- Step 4: Recreate the single fund score function with FIXED JSON extraction
CREATE OR REPLACE FUNCTION public._calculate_single_fund_score(
  fund record, 
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
    
    -- Extract metric value from database columns
    CASE metric
      WHEN 'ytd' THEN value := fund.ytd_return;
      WHEN 'oneYear' THEN value := fund.one_year_return;
      WHEN 'threeYear' THEN value := fund.three_year_return;
      WHEN 'fiveYear' THEN value := fund.five_year_return;
      WHEN 'tenYear' THEN value := fund.ten_year_return;
      WHEN 'sharpeRatio3Y' THEN value := fund.sharpe_ratio;
      WHEN 'stdDev3Y' THEN value := fund.standard_deviation_3y;
      WHEN 'stdDev5Y' THEN value := fund.standard_deviation_5y;
      WHEN 'upCapture3Y' THEN value := fund.up_capture_ratio;
      WHEN 'downCapture3Y' THEN value := fund.down_capture_ratio;
      WHEN 'alpha5Y' THEN value := fund.alpha;
      WHEN 'expenseRatio' THEN value := fund.expense_ratio;
      WHEN 'managerTenure' THEN value := fund.manager_tenure;
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

-- Step 5: Recreate the main scoring function
CREATE OR REPLACE FUNCTION public.calculate_scores_as_of(
  p_date date,
  p_asset_class_id uuid DEFAULT NULL,
  p_global boolean DEFAULT false
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
  
  fund_record record;
  asset_class_funds record[];
  metric_stats jsonb;
  fund_scores jsonb;
  asset_class_name text;
  peer_funds record[];
  benchmark_funds record[];
  raw_scores numeric[];
  anchors jsonb;
BEGIN
  IF p_global THEN
    -- Get funds for the specified date across all asset classes
    SELECT array_agg(f.*) INTO asset_class_funds
    FROM public.get_funds_as_of(p_date) f
    WHERE f.asset_class_id IS NOT NULL;
  ELSE
    -- Require asset class id for non-global scoring
    IF p_asset_class_id IS NULL THEN
      RAISE EXCEPTION 'asset_class_id required when p_global is false';
    END IF;

    -- Get funds for the specified date and asset class
    SELECT array_agg(f.*) INTO asset_class_funds
    FROM public.get_funds_as_of(p_date) f
    WHERE f.asset_class_id = p_asset_class_id
      AND f.asset_class_id IS NOT NULL;
  END IF;
  
  IF asset_class_funds IS NULL OR array_length(asset_class_funds, 1) < 2 THEN
    -- Return default scores for insufficient funds
    FOREACH fund_record IN ARRAY asset_class_funds
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
  
  -- Separate peer funds and benchmarks
  peer_funds := ARRAY[]::record[];
  benchmark_funds := ARRAY[]::record[];
  
  FOREACH fund_record IN ARRAY asset_class_funds
  LOOP
    IF fund_record.is_benchmark THEN
      benchmark_funds := array_append(benchmark_funds, fund_record);
    ELSE
      peer_funds := array_append(peer_funds, fund_record);
    END IF;
  END LOOP;
  
  -- Calculate metric statistics for peer funds only (exactly matching client-side)
  metric_stats := public._calculate_metric_statistics(peer_funds);
  
  -- Calculate scores for all funds (including benchmarks)
  fund_scores := public._calculate_fund_scores(asset_class_funds, metric_stats, default_weights);
  
  -- Get raw scores for scaling
  raw_scores := ARRAY[]::numeric[];
  FOR i IN 1..array_length(fund_scores, 1)
  LOOP
    raw_scores := array_append(raw_scores, (fund_scores[i]->>'rawReweighted')::numeric);
  END LOOP;
  
  -- Calculate robust scaling anchors if enabled
  IF enable_robust_scaling AND array_length(raw_scores, 1) >= 10 THEN
    anchors := public._calculate_robust_scaling_anchors(raw_scores);
  END IF;
  
  -- Scale scores and calculate percentiles
  FOR i IN 1..array_length(asset_class_funds, 1)
  LOOP
    fund_record := asset_class_funds[i];
    asset_class_id := fund_record.asset_class_id;
    ticker := fund_record.ticker;
    name := fund_record.name;
    is_benchmark := fund_record.is_benchmark;
    is_recommended := fund_record.is_recommended;
    
    -- Get score data
    score_raw := (fund_scores[i]->>'rawReweighted')::numeric;
    metrics_used := (fund_scores[i]->>'metricsUsed')::int;
    total_possible_metrics := (fund_scores[i]->>'totalPossibleMetrics')::int;
    score_breakdown := fund_scores[i]->'breakdown';
    
    -- Apply tiny class fallback if enabled
    IF enable_tiny_class_fallback AND NOT is_benchmark THEN
      score_raw := public._apply_tiny_class_fallback(score_raw, fund_scores[i]);
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

-- Step 6: Grant execute permissions
GRANT EXECUTE ON FUNCTION public.calculate_scores_as_of(date, uuid, boolean) TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

-- Step 7: Verify the fix
DO $$
BEGIN
  RAISE NOTICE 'Fixed server-side scoring function deployed successfully!';
  RAISE NOTICE 'The ABS(text) error has been resolved.';
  RAISE NOTICE 'Run test_fixed_scoring.sql to verify the function works.';
END $$; 