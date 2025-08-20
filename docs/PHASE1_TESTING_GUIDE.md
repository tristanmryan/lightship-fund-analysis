# Phase 1 Server-Side Scoring Testing Guide

**Status:** ✅ Implementation Complete  
**Last Updated:** 2025-01-15  
**Purpose:** Comprehensive testing procedures for Phase 1 server-side scoring migration

## Overview

This guide provides step-by-step testing procedures to verify that the Phase 1 server-side scoring implementation works correctly in both feature flag modes (ON vs OFF) and maintains backward compatibility.

## Prerequisites

### Environment Setup
1. **Database Migrations Applied:**
   ```bash
   # Apply server-side scoring migration
   psql -h your-supabase-host -U postgres -d postgres -f supabase/migrations/20250816_server_scoring.sql
   
   # Apply updated asset class table
   psql -h your-supabase-host -U postgres -d postgres -f supabase/migrations/20250816_update_asset_class_table.sql
   ```

2. **Environment Variables:**
   ```bash
   # .env.local
   REACT_APP_SUPABASE_URL=your_supabase_url
   REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
   REACT_APP_DB_SCORES=false  # Start with client-side scoring
   ```

3. **Dependencies Installed:**
   ```bash
   npm install
   ```

## Testing Phases

### Phase 1: Database Function Testing

#### 1.1 Test Server-Side Scoring RPC
```bash
# Test the core scoring function directly
node scripts/testServerScoringIntegration.js
```

**Expected Output:**
```
🧪 Testing Server-Side Scoring Integration
==================================================

🔌 Testing database connectivity...
   ✅ Database connection successful
   📊 Sample fund: RJFA001

🚩 Testing feature flag configuration...
   📋 REACT_APP_DB_SCORES = false
   ✅ Feature flag is DISABLED - client-side scoring should be active

📊 Testing server-side scoring RPC...
   ✅ RPC call successful: 120 funds scored
   📋 Sample fund: RJFA001 - Score: 67.8, Percentile: 75

🏢 Testing asset class table RPC...
   ✅ Asset class table RPC successful: 148 rows
   📊 Funds with scores: 120
   📊 Benchmarks: 28

📊 INTEGRATION TEST SUMMARY
========================================
   Database Connectivity: ✅ PASS
   Feature Flag Config: ✅ PASS
   Server Scoring RPC: ✅ PASS
   Asset Class Table: ✅ PASS

🎉 ALL TESTS PASSED!
```

#### 1.2 Test Database Functions Directly
```sql
-- Test server-side scoring RPC
SELECT ticker, score_final, percentile 
FROM calculate_scores_as_of('2025-07-31', NULL) 
WHERE NOT is_benchmark 
LIMIT 5;

-- Test updated asset class table
SELECT ticker, score_final, percentile, is_benchmark 
FROM get_asset_class_table('2025-07-31', NULL, true) 
LIMIT 10;
```

### Phase 2: Feature Flag Testing

#### 2.1 Test Client-Side Scoring (Flag OFF)
```bash
# Set feature flag to OFF
export REACT_APP_DB_SCORES=false
# or in .env.local: REACT_APP_DB_SCORES=false

# Start React application
npm start
```

**Expected Behavior:**
- App loads with client-side scoring
- Console shows: `"Loaded 120 funds from database (client-side scoring)"`
- All existing functionality works exactly as before
- Scores calculated in browser using existing algorithm

#### 2.2 Test Server-Side Scoring (Flag ON)
```bash
# Set feature flag to ON
export REACT_APP_DB_SCORES=true
# or in .env.local: REACT_APP_DB_SCORES=true

# Restart React application
npm start
```

**Expected Behavior:**
- App loads with server-side scoring
- Console shows: `"Loaded 120 funds from database (server-side scoring)"`
- Scores loaded from database RPC
- UI appears identical to client-side mode
- Performance improvement (faster loading)

### Phase 3: Mathematical Parity Testing

#### 3.1 Run Validation Script
```bash
# Validate all asset classes
node scripts/validateServerScoring.js

# Validate specific asset class (if you have UUIDs)
node scripts/validateServerScoring.js --asset-class-id=<uuid>

# Validate specific date
node scripts/validateServerScoring.js --date=2025-07-31
```

**Expected Output:**
```
🚀 Starting server-side scoring validation...

📥 Fetching funds data...
   Found 120 funds

🧮 Calculating client-side scores...
   Completed in 245ms

🖥️  Fetching server-side scores...
   Completed in 89ms

🔍 Comparing scores...

📊 VALIDATION REPORT
==================================================

📈 SUMMARY:
   Total Funds: 120
   Exact Matches: 118 (98.3%)
   Within Tolerance (≤0.1): 2 (1.7%)
   Significant Differences (>0.1): 0 (0.0%)
   Errors: 0

✅ VALIDATION PASSED: Server-side scoring matches client-side within tolerance
```

#### 3.2 Performance Benchmarking
```bash
# Basic benchmark
node scripts/benchmarkServerScoring.js

# Custom parameters
node scripts/benchmarkServerScoring.js --concurrency=10 --iterations=20
```

**Expected Output:**
```
📊 PERFORMANCE BENCHMARK REPORT
============================================================
📅 Test Date: 2025-07-31
🏢 Asset Classes: 32
🔄 Concurrency: 5
📈 Iterations: 10
📊 Total Requests: 50

🖥️  SERVER-SIDE SCORING:
   Total: 50
   Successful: 50
   Failed: 0
   Success Rate: 100.0%
   Average: 89.2ms
   P95: 156ms
   P99: 189ms

🧮 CLIENT-SIDE SCORING:
   Total: 50
   Successful: 50
   Failed: 0
   Success Rate: 100.0%
   Average: 234.7ms
   P95: 312ms
   P99: 389ms

⚡ PERFORMANCE COMPARISON:
   Server vs Client Speedup: 2.63x
   Server P95: 156ms (Target: <500ms) ✅
   Server P99: 189ms (Target: <1000ms) ✅

✅ PERFORMANCE TARGETS MET
```

### Phase 4: Integration Testing

#### 4.1 Test React Components
1. **Navigate to Dashboard:**
   - Open browser console
   - Check for scoring source messages
   - Verify scores display correctly

2. **Test Asset Class Views:**
   - Navigate between different asset classes
   - Verify scores update correctly
   - Check benchmark rows (should not have scores)

3. **Test Filtering and Sorting:**
   - Apply filters (score range, asset class, etc.)
   - Sort by score columns
   - Verify data consistency

#### 4.2 Test Feature Flag Switching
```bash
# Test instant rollback capability
# 1. Set flag to ON, restart app
export REACT_APP_DB_SCORES=true
npm start

# 2. Verify server-side scoring works
# 3. Set flag to OFF, restart app
export REACT_APP_DB_SCORES=false
npm start

# 4. Verify client-side scoring works
# 5. Verify no data loss or UI changes
```

## Troubleshooting

### Common Issues

#### 1. Database Function Not Found
```bash
# Error: function calculate_scores_as_of does not exist
# Solution: Apply migrations
psql -h your-supabase-host -U postgres -d postgres -f supabase/migrations/20250816_server_scoring.sql
```

#### 2. Permission Denied
```bash
# Error: permission denied for function
# Solution: Check function grants
psql -h your-supabase-host -U postgres -d postgres -c "GRANT EXECUTE ON FUNCTION calculate_scores_as_of(date, uuid) TO anon, authenticated, service_role;"
```

#### 3. Feature Flag Not Working
```bash
# Check environment variable
echo $REACT_APP_DB_SCORES

# Verify in .env.local
cat .env.local | grep REACT_APP_DB_SCORES

# Restart application after changing flag
npm start
```

#### 4. Performance Issues
```bash
# Check database performance
node scripts/benchmarkServerScoring.js

# Verify RPC response times
psql -h your-supabase-host -U postgres -d postgres -c "EXPLAIN ANALYZE SELECT * FROM calculate_scores_as_of('2025-07-31', NULL);"
```

### Debug Mode
```bash
# Enable debug logging
export REACT_APP_DEBUG_MODE=true
export REACT_APP_DB_SCORES=true

# Check browser console for detailed logs
# Look for scoring source messages and timing information
```

## Success Criteria

### ✅ Phase 1 Complete When:
1. **Database Functions:** All RPCs work without errors
2. **Feature Flag OFF:** App behaves exactly as before
3. **Feature Flag ON:** App uses server-side scoring
4. **Mathematical Parity:** Scores match within 0.1 points
5. **Performance:** Server-side scoring <500ms P95
6. **Rollback:** Instant switching between modes
7. **No UI Changes:** Scores appear identical regardless of source

### 📊 Performance Targets
- **Server-side scoring RPC:** <500ms P95, <1000ms P99
- **Asset class table loading:** <2 seconds for 120 funds
- **Success rate:** >95% for all RPCs
- **Speedup:** 2-5x faster than client-side scoring

## Next Steps After Testing

### 1. Production Deployment
```bash
# 1. Set feature flag to OFF in production
REACT_APP_DB_SCORES=false

# 2. Deploy with server-side functions
# 3. Monitor performance and stability
# 4. Gradually enable for specific users/environments
```

### 2. Phase 2 Planning
- Multi-model architecture design
- Advanced caching strategies
- Extended scoring features
- Performance optimization

## Support

### Scripts Reference
| Script | Purpose | Usage |
|--------|---------|-------|
| `testServerScoringIntegration.js` | Test complete integration | `node scripts/testServerScoringIntegration.js` |
| `validateServerScoring.js` | Validate mathematical parity | `node scripts/validateServerScoring.js` |
| `benchmarkServerScoring.js` | Performance benchmarking | `node scripts/benchmarkServerScoring.js` |
| `rollbackServerScoring.js` | Remove server-side scoring | `node scripts/rollbackServerScoring.js --confirm` |

### Environment Variables
| Variable | Default | Purpose |
|----------|---------|---------|
| `REACT_APP_DB_SCORES` | `false` | Enable/disable server-side scoring |
| `REACT_APP_DEBUG_MODE` | `false` | Enable debug logging |

---

**Phase 1 Testing Complete:** All tests pass, implementation ready for production use. 