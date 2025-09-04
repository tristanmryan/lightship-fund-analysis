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
