-- Migration: Upload RPCs for CSV Data Import
-- Provides idempotent upsert functions for fund and benchmark performance data
-- plus activity logging for upload tracking

-- Guard: Ensure extension is available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Upsert Fund Performance Data
-- Accepts JSONB array of fund performance records and performs idempotent upserts
CREATE OR REPLACE FUNCTION public.upsert_fund_performance(csv_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  record_count integer := 0;
  error_count integer := 0;
  inserted_count integer := 0;
  updated_count integer := 0;
  skipped_count integer := 0;
  result_data jsonb;
  record_item jsonb;
  fund_record record;
  conflict_action text;
BEGIN
  -- Validate input
  IF csv_data IS NULL OR jsonb_array_length(csv_data) = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No data provided',
      'records_processed', 0,
      'inserted', 0,
      'updated', 0,
      'skipped', 0,
      'errors', jsonb_build_array()
    );
  END IF;

  -- Process each record in the array
  FOR record_item IN SELECT * FROM jsonb_array_elements(csv_data)
  LOOP
    BEGIN
      record_count := record_count + 1;
      
      -- Extract and validate required fields
      IF NOT (record_item ? 'fund_ticker') OR NOT (record_item ? 'date') THEN
        error_count := error_count + 1;
        CONTINUE;
      END IF;
      
      -- Validate date format and EOM requirement
      IF NOT (record_item->>'date' ~ '^\d{4}-\d{2}-\d{2}$') THEN
        error_count := error_count + 1;
        CONTINUE;
      END IF;
      
      -- Check if date is end-of-month
      DECLARE
        input_date date := (record_item->>'date')::date;
        eom_date date := (DATE_TRUNC('month', input_date) + INTERVAL '1 month - 1 day')::date;
      BEGIN
        IF input_date != eom_date THEN
          -- Auto-convert to EOM
          record_item := jsonb_set(record_item, '{date}', to_jsonb(eom_date::text));
        END IF;
      END;
      
      -- Check if record already exists
      SELECT 'update' INTO conflict_action
      FROM public.fund_performance 
      WHERE fund_ticker = (record_item->>'fund_ticker') 
        AND date = (record_item->>'date')::date;
      
      IF NOT FOUND THEN
        conflict_action := 'insert';
      END IF;
      
      -- Perform upsert
      INSERT INTO public.fund_performance (
        fund_ticker,
        date,
        ytd_return,
        one_year_return,
        three_year_return,
        five_year_return,
        ten_year_return,
        sharpe_ratio,
        standard_deviation_3y,
        standard_deviation_5y,
        expense_ratio,
        alpha,
        beta,
        manager_tenure,
        up_capture_ratio,
        down_capture_ratio
      ) VALUES (
        record_item->>'fund_ticker',
        (record_item->>'date')::date,
        NULLIF(record_item->>'ytd_return', '')::numeric,
        NULLIF(record_item->>'one_year_return', '')::numeric,
        NULLIF(record_item->>'three_year_return', '')::numeric,
        NULLIF(record_item->>'five_year_return', '')::numeric,
        NULLIF(record_item->>'ten_year_return', '')::numeric,
        NULLIF(record_item->>'sharpe_ratio', '')::numeric,
        NULLIF(record_item->>'standard_deviation_3y', '')::numeric,
        NULLIF(record_item->>'standard_deviation_5y', '')::numeric,
        NULLIF(record_item->>'expense_ratio', '')::numeric,
        NULLIF(record_item->>'alpha', '')::numeric,
        NULLIF(record_item->>'beta', '')::numeric,
        NULLIF(record_item->>'manager_tenure', '')::numeric,
        NULLIF(record_item->>'up_capture_ratio', '')::numeric,
        NULLIF(record_item->>'down_capture_ratio', '')::numeric
      )
      ON CONFLICT (fund_ticker, date) DO UPDATE SET
        ytd_return = EXCLUDED.ytd_return,
        one_year_return = EXCLUDED.one_year_return,
        three_year_return = EXCLUDED.three_year_return,
        five_year_return = EXCLUDED.five_year_return,
        ten_year_return = EXCLUDED.ten_year_return,
        sharpe_ratio = EXCLUDED.sharpe_ratio,
        standard_deviation_3y = EXCLUDED.standard_deviation_3y,
        standard_deviation_5y = EXCLUDED.standard_deviation_5y,
        expense_ratio = EXCLUDED.expense_ratio,
        alpha = EXCLUDED.alpha,
        beta = EXCLUDED.beta,
        manager_tenure = EXCLUDED.manager_tenure,
        up_capture_ratio = EXCLUDED.up_capture_ratio,
        down_capture_ratio = EXCLUDED.down_capture_ratio;
      
      -- Track operation type
      IF conflict_action = 'insert' THEN
        inserted_count := inserted_count + 1;
      ELSE
        updated_count := updated_count + 1;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      error_count := error_count + 1;
      -- Log error but continue processing
      RAISE WARNING 'Error processing fund record %: %', record_count, SQLERRM;
    END;
  END LOOP;
  
  skipped_count := record_count - inserted_count - updated_count - error_count;
  
  RETURN jsonb_build_object(
    'success', error_count = 0,
    'records_processed', record_count,
    'inserted', inserted_count,
    'updated', updated_count,
    'skipped', skipped_count,
    'errors', error_count
  );
END;
$$;

-- 2. Upsert Benchmark Performance Data
-- Similar to fund performance but for benchmark data
CREATE OR REPLACE FUNCTION public.upsert_benchmark_performance(csv_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  record_count integer := 0;
  error_count integer := 0;
  inserted_count integer := 0;
  updated_count integer := 0;
  skipped_count integer := 0;
  result_data jsonb;
  record_item jsonb;
  conflict_action text;
BEGIN
  -- Validate input
  IF csv_data IS NULL OR jsonb_array_length(csv_data) = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No data provided',
      'records_processed', 0,
      'inserted', 0,
      'updated', 0,
      'skipped', 0,
      'errors', jsonb_build_array()
    );
  END IF;

  -- Process each record in the array
  FOR record_item IN SELECT * FROM jsonb_array_elements(csv_data)
  LOOP
    BEGIN
      record_count := record_count + 1;
      
      -- Extract and validate required fields
      IF NOT (record_item ? 'benchmark_ticker') OR NOT (record_item ? 'date') THEN
        error_count := error_count + 1;
        CONTINUE;
      END IF;
      
      -- Validate date format and EOM requirement
      IF NOT (record_item->>'date' ~ '^\d{4}-\d{2}-\d{2}$') THEN
        error_count := error_count + 1;
        CONTINUE;
      END IF;
      
      -- Check if date is end-of-month and auto-convert
      DECLARE
        input_date date := (record_item->>'date')::date;
        eom_date date := (DATE_TRUNC('month', input_date) + INTERVAL '1 month - 1 day')::date;
      BEGIN
        IF input_date != eom_date THEN
          -- Auto-convert to EOM
          record_item := jsonb_set(record_item, '{date}', to_jsonb(eom_date::text));
        END IF;
      END;
      
      -- Check if record already exists
      SELECT 'update' INTO conflict_action
      FROM public.benchmark_performance 
      WHERE benchmark_ticker = (record_item->>'benchmark_ticker') 
        AND date = (record_item->>'date')::date;
      
      IF NOT FOUND THEN
        conflict_action := 'insert';
      END IF;
      
      -- Perform upsert
      INSERT INTO public.benchmark_performance (
        benchmark_ticker,
        date,
        ytd_return,
        one_year_return,
        three_year_return,
        five_year_return,
        ten_year_return,
        sharpe_ratio,
        standard_deviation_3y,
        standard_deviation_5y,
        expense_ratio,
        alpha,
        beta,
        up_capture_ratio,
        down_capture_ratio
      ) VALUES (
        record_item->>'benchmark_ticker',
        (record_item->>'date')::date,
        NULLIF(record_item->>'ytd_return', '')::numeric,
        NULLIF(record_item->>'one_year_return', '')::numeric,
        NULLIF(record_item->>'three_year_return', '')::numeric,
        NULLIF(record_item->>'five_year_return', '')::numeric,
        NULLIF(record_item->>'ten_year_return', '')::numeric,
        NULLIF(record_item->>'sharpe_ratio', '')::numeric,
        NULLIF(record_item->>'standard_deviation_3y', '')::numeric,
        NULLIF(record_item->>'standard_deviation_5y', '')::numeric,
        NULLIF(record_item->>'expense_ratio', '')::numeric,
        NULLIF(record_item->>'alpha', '')::numeric,
        NULLIF(record_item->>'beta', '')::numeric,
        NULLIF(record_item->>'up_capture_ratio', '')::numeric,
        NULLIF(record_item->>'down_capture_ratio', '')::numeric
      )
      ON CONFLICT (benchmark_ticker, date) DO UPDATE SET
        ytd_return = EXCLUDED.ytd_return,
        one_year_return = EXCLUDED.one_year_return,
        three_year_return = EXCLUDED.three_year_return,
        five_year_return = EXCLUDED.five_year_return,
        ten_year_return = EXCLUDED.ten_year_return,
        sharpe_ratio = EXCLUDED.sharpe_ratio,
        standard_deviation_3y = EXCLUDED.standard_deviation_3y,
        standard_deviation_5y = EXCLUDED.standard_deviation_5y,
        expense_ratio = EXCLUDED.expense_ratio,
        alpha = EXCLUDED.alpha,
        beta = EXCLUDED.beta,
        up_capture_ratio = EXCLUDED.up_capture_ratio,
        down_capture_ratio = EXCLUDED.down_capture_ratio;
      
      -- Track operation type
      IF conflict_action = 'insert' THEN
        inserted_count := inserted_count + 1;
      ELSE
        updated_count := updated_count + 1;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      error_count := error_count + 1;
      -- Log error but continue processing
      RAISE WARNING 'Error processing benchmark record %: %', record_count, SQLERRM;
    END;
  END LOOP;
  
  skipped_count := record_count - inserted_count - updated_count - error_count;
  
  RETURN jsonb_build_object(
    'success', error_count = 0,
    'records_processed', record_count,
    'inserted', inserted_count,
    'updated', updated_count,
    'skipped', skipped_count,
    'errors', error_count
  );
END;
$$;

-- 3. Activity Logging Function
-- Logs upload activities with user info, action type, and details
CREATE OR REPLACE FUNCTION public.log_activity(
  user_info jsonb,
  action text,
  details jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  activity_id uuid;
  user_id_val uuid;
  ip_address_val inet;
  user_agent_val text;
BEGIN
  -- Extract user information
  user_id_val := COALESCE((user_info->>'user_id')::uuid, NULL);
  ip_address_val := COALESCE((user_info->>'ip_address')::inet, NULL);
  user_agent_val := COALESCE(user_info->>'user_agent', NULL);
  
  -- Insert activity log
  INSERT INTO public.activity_logs (
    id,
    user_id,
    action,
    details,
    ip_address,
    user_agent,
    timestamp
  ) VALUES (
    uuid_generate_v4(),
    user_id_val,
    action,
    details,
    ip_address_val,
    user_agent_val,
    NOW()
  ) RETURNING id INTO activity_id;
  
  RETURN activity_id;
END;
$$;

-- Grant execute permissions to service role only (secure upload operations)
REVOKE ALL ON FUNCTION public.upsert_fund_performance(jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.upsert_fund_performance(jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.upsert_benchmark_performance(jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.upsert_benchmark_performance(jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.log_activity(jsonb, text, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.log_activity(jsonb, text, jsonb) TO service_role;

-- Helper function to validate CSV data structure before upload
CREATE OR REPLACE FUNCTION public.validate_csv_structure(
  csv_data jsonb,
  upload_type text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  required_columns text[];
  optional_columns text[];
  missing_columns text[] := '{}';
  extra_columns text[] := '{}';
  sample_record jsonb;
  column_name text;
  validation_result jsonb;
BEGIN
  -- Define required and optional columns based on upload type
  IF upload_type = 'fund' THEN
    required_columns := ARRAY['fund_ticker', 'date'];
    optional_columns := ARRAY[
      'ytd_return', 'one_year_return', 'three_year_return', 'five_year_return', 'ten_year_return',
      'sharpe_ratio', 'standard_deviation_3y', 'standard_deviation_5y', 'expense_ratio',
      'alpha', 'beta', 'manager_tenure', 'up_capture_ratio', 'down_capture_ratio'
    ];
  ELSIF upload_type = 'benchmark' THEN
    required_columns := ARRAY['benchmark_ticker', 'date'];
    optional_columns := ARRAY[
      'ytd_return', 'one_year_return', 'three_year_return', 'five_year_return', 'ten_year_return',
      'sharpe_ratio', 'standard_deviation_3y', 'standard_deviation_5y', 'expense_ratio',
      'alpha', 'beta', 'up_capture_ratio', 'down_capture_ratio'
    ];
  ELSE
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Invalid upload type. Must be "fund" or "benchmark"'
    );
  END IF;
  
  -- Validate input
  IF csv_data IS NULL OR jsonb_array_length(csv_data) = 0 THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'No data provided'
    );
  END IF;
  
  -- Get first record to check structure
  sample_record := csv_data->0;
  
  -- Check for required columns
  FOREACH column_name IN ARRAY required_columns
  LOOP
    IF NOT (sample_record ? column_name) THEN
      missing_columns := array_append(missing_columns, column_name);
    END IF;
  END LOOP;
  
  -- Return validation result
  IF array_length(missing_columns, 1) > 0 THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Missing required columns',
      'missing_columns', to_jsonb(missing_columns),
      'required_columns', to_jsonb(required_columns),
      'optional_columns', to_jsonb(optional_columns)
    );
  END IF;
  
  RETURN jsonb_build_object(
    'valid', true,
    'required_columns', to_jsonb(required_columns),
    'optional_columns', to_jsonb(optional_columns),
    'record_count', jsonb_array_length(csv_data)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_csv_structure(jsonb, text) TO anon, authenticated, service_role;

-- Comments for documentation
COMMENT ON FUNCTION public.upsert_fund_performance(jsonb) IS 
'Performs idempotent upsert of fund performance data from CSV. Auto-converts dates to EOM. Returns summary of operations performed.';

COMMENT ON FUNCTION public.upsert_benchmark_performance(jsonb) IS 
'Performs idempotent upsert of benchmark performance data from CSV. Auto-converts dates to EOM. Returns summary of operations performed.';

COMMENT ON FUNCTION public.log_activity(jsonb, text, jsonb) IS 
'Logs user activities for audit trail. Accepts user info, action type, and details as JSONB objects.';

COMMENT ON FUNCTION public.validate_csv_structure(jsonb, text) IS 
'Validates CSV data structure before upload. Checks for required columns and returns validation summary.';