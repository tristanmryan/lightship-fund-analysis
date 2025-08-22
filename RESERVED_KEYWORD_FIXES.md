# PostgreSQL Reserved Keyword Fixes - Server-Side Scoring Migration

## Overview
This document summarizes all the PostgreSQL reserved keyword conflicts that were identified and fixed in the `supabase/migrations/20250816_server_scoring_fixed.sql` file.

## Reserved Keywords Fixed

### 1. `values` → `input_values`
**Location:** Multiple function parameters and variables
**Issue:** `values` is a reserved keyword in PostgreSQL
**Fix:** Renamed to `input_values` throughout

**Functions affected:**
- `_calculate_mean(input_values numeric[])`
- `_calculate_stddev(input_values numeric[], mean_val numeric)`

**Variable references updated:**
- `FOREACH val IN ARRAY input_values`
- `array_length(input_values, 1)`
- All function calls updated to use new parameter names

### 2. `sorted_values` → `sorted_input_values`
**Location:** `_calculate_quantile` function
**Issue:** Part of the `values` reserved keyword problem
**Fix:** Renamed to `sorted_input_values`

**Functions affected:**
- `_calculate_quantile(sorted_input_values numeric[], q numeric)`

**Variable references updated:**
- `array_length(sorted_input_values, 1)`
- `sorted_input_values[FLOOR(k) + 1]`
- `sorted_input_values[LEAST(FLOOR(k) + 2, n)]`

### 3. `raw_scores` → `input_raw_scores`
**Location:** Function parameters
**Issue:** Potential conflict with reserved keywords
**Fix:** Renamed to `input_raw_scores` for clarity

**Functions affected:**
- `_calculate_robust_scaling_anchors(input_raw_scores numeric[])`
- `_calculate_percentile(raw_score numeric, input_raw_scores numeric[])`

**Variable references updated:**
- `ARRAY(SELECT unnest(input_raw_scores) ORDER BY unnest)`
- `FOREACH score IN ARRAY input_raw_scores`
- `array_length(input_raw_scores, 1)`

### 4. `values` → `metric_values` (in metric statistics)
**Location:** `_calculate_metric_statistics` function
**Issue:** Local variable using reserved keyword
**Fix:** Renamed to `metric_values`

**Variable references updated:**
- `metric_values := ARRAY[]::numeric[]`
- `metric_values := array_append(metric_values, fund.ytd_return)`
- `mean_val := public._calculate_mean(metric_values)`
- `stddev_val := public._calculate_stddev(metric_values, mean_val)`
- `count_val := array_length(metric_values, 1)`
- `sorted_metric_values := ARRAY(SELECT unnest(metric_values) ORDER BY unnest)`
- `min_val := (SELECT MIN(v) FROM unnest(metric_values) v WHERE v IS NOT NULL)`
- `max_val := (SELECT MAX(v) FROM unnest(metric_values) v WHERE v IS NOT NULL)`

## Functions Successfully Fixed

1. ✅ `_calculate_mean` - Parameter renamed from `values` to `input_values`
2. ✅ `_calculate_stddev` - Parameter renamed from `values` to `input_values`
3. ✅ `_calculate_zscore` - No changes needed
4. ✅ `_calculate_quantile` - Parameter renamed from `sorted_values` to `sorted_input_values`
5. ✅ `_erf` - No changes needed
6. ✅ `_erfinv` - No changes needed
7. ✅ `_winsorize_z` - No changes needed
8. ✅ `_scale_score` - No changes needed
9. ✅ `_calculate_robust_scaling_anchors` - Parameter renamed from `raw_scores` to `input_raw_scores`
10. ✅ `_scale_score_robust` - No changes needed
11. ✅ `_apply_tiny_class_fallback` - No changes needed
12. ✅ `_calculate_percentile` - Parameter renamed from `raw_scores` to `input_raw_scores`
13. ✅ `_calculate_metric_statistics` - Local variable renamed from `values` to `metric_values`
14. ✅ `_calculate_fund_scores` - No changes needed
15. ✅ `_calculate_single_fund_score` - No changes needed
16. ✅ `calculate_scores_as_of` - No changes needed

## Verification

### SQL Syntax Test
The fixed migration file can now be parsed without PostgreSQL syntax errors.

### Function Signature Consistency
All function calls use the updated parameter names, ensuring consistency across the codebase.

### Reserved Keyword Compliance
No PostgreSQL reserved keywords are used as parameter names or in contexts that would cause conflicts.

## Deployment Notes

1. **Drop Existing Functions First:** The deployment script drops all existing functions before recreating them with the fixed signatures.

2. **Parameter Name Changes:** All calling code must use the new parameter names:
   - `_calculate_mean(input_values)` instead of `_calculate_mean(values)`
   - `_calculate_stddev(input_values, mean_val)` instead of `_calculate_stddev(values, mean_val)`
   - etc.

3. **Backward Compatibility:** This is a breaking change for any external code calling these functions directly.

4. **Testing Required:** After deployment, verify that all functions execute without syntax errors and return expected results.

## Files Modified

- `supabase/migrations/20250816_server_scoring_fixed.sql` - Main migration file with all fixes
- `deploy_fixed_scoring.sql` - Deployment script for applying fixes
- `test_syntax_fix.sql` - SQL syntax verification script
- `RESERVED_KEYWORD_FIXES.md` - This documentation file

## Next Steps

1. Deploy the fixed migration using `deploy_fixed_scoring.sql`
2. Test the functions with sample data
3. Verify that server-side scoring works without 400 errors
4. Update any external documentation referencing the old function signatures 