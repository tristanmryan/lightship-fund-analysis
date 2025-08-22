-- Test script for fixed server-side scoring function
-- Run this in your Supabase SQL editor to verify the fix

-- 1. First, let's check if the function exists and can be called
SELECT 
  routine_name, 
  routine_type, 
  data_type,
  is_deterministic
FROM information_schema.routines 
WHERE routine_name = 'calculate_scores_as_of' 
  AND routine_schema = 'public';

-- 2. Test the function with a simple call (this should not error)
-- If you have data, this will return results; if not, it will return empty
SELECT * FROM public.calculate_scores_as_of(CURRENT_DATE, NULL) LIMIT 5;

-- 3. Test with a specific date (adjust as needed)
SELECT * FROM public.calculate_scores_as_of('2024-12-31'::date, NULL) LIMIT 5;

-- 4. Test the helper functions individually
SELECT public._calculate_mean(ARRAY[1,2,3,4,5]::numeric[]) as mean_test;
SELECT public._calculate_stddev(ARRAY[1,2,3,4,5]::numeric[], 3) as stddev_test;
SELECT public._calculate_zscore(5, 3, 2) as zscore_test;

-- 5. Check if get_funds_as_of works (dependency function)
SELECT COUNT(*) as fund_count FROM public.get_funds_as_of(CURRENT_DATE);

-- 6. Test the complete flow with a small dataset
-- This will help identify any remaining issues
DO $$
DECLARE
  test_result record;
BEGIN
  -- Try to call the function and catch any errors
  BEGIN
    SELECT * INTO test_result 
    FROM public.calculate_scores_as_of(CURRENT_DATE, NULL) 
    LIMIT 1;
    
    RAISE NOTICE 'SUCCESS: Function executed without errors';
    RAISE NOTICE 'Result: %', test_result;
    
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ERROR: %', SQLERRM;
    RAISE NOTICE 'DETAIL: %', SQLSTATE;
  END;
END $$;

-- 7. Check function signature and return columns
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'calculate_scores_as_of' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 8. Verify all helper functions exist
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name LIKE '_calculate_%'
ORDER BY routine_name; 