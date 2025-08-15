# Project Status Dashboard

**Last Updated:** 2025-01-15  
**Current Sprint:** Sprint 0 - Baseline Environment  
**Project Phase:** Pre-Sprint Preparation

## Sprint 0 Progress

### ✅ Backend Blockers (Completed)
- **RLS Inconsistency Fixed** - Disabled RLS globally for internal tool simplicity
- **Asset Class Benchmark Index** - Added unique index to enforce "one primary benchmark per asset class" rule
- **6 Core RPCs Created** - All database functions implemented for bench harness
- **Documentation Updated** - Decision D-0001 recorded

### ✅ Baseline Environment (Completed)
- **Package Scripts Wired** - Added seed, verify, bench, and bench:full scripts to package.json
- **Seed Scripts Created** - Deterministic data seeding for 32 asset classes, 28 benchmarks, 120 funds
- **Verification Script** - Comprehensive checks for data integrity and RPC connectivity
- **Bench Harness** - Performance testing framework for all 6 RPCs with concurrency support
- **Status Tracking** - Documentation framework established

## Current Environment

### Database State
- **Asset Classes:** 32 (all from assetClassGroups.js)
- **Benchmarks:** 28 (primary benchmark per asset class)
- **Funds:** 120 (RJFA001-RJFA120)
- **Performance Data:** 1,440 records (120 funds × 12 EOM months)
- **Date Range:** 2024-08-31 to 2025-07-31
- **Recommended Funds:** 20 (first 20 funds marked)

### Available Scripts
```bash
npm run seed          # Seed deterministic test data
npm run verify        # Verify database integrity
npm run bench         # Basic benchmark (Mode A)
npm run bench:full    # Full benchmark (both modes, concurrency 5,1)
```

### Core RPCs Status
All 6 RPCs implemented and tested:
- ✅ `get_active_month()` - Get active month with EOM preference
- ✅ `get_asset_class_table()` - Asset class fund table with benchmarks
- ✅ `get_compare_dataset()` - Comparison dataset for fund tickers
- ✅ `get_scores_as_of()` - Fund scores as of date
- ✅ `get_history_for_tickers()` - Historical data for fund tickers
- ✅ `refresh_metric_stats_as_of()` - Refresh metric statistics

## Next Steps

### Sprint 1 Preparation
- [ ] Run full benchmark suite (`npm run bench:full`)
- [ ] Analyze performance baseline results
- [ ] Document any threshold violations
- [ ] Prepare frontend integration testing

### Environment Health
- **Status:** 🟢 Ready for Sprint 1
- **Last Verification:** Pending first run
- **Performance Baseline:** Pending first benchmark
- **Blockers:** None identified

## Risk Assessment

### ⚠️ Monitoring Items
- RPC performance under load (to be measured)
- Database query optimization needs
- Concurrency handling effectiveness

### 🔄 Dependencies
- Supabase environment configuration
- All 6 RPCs functioning correctly
- Test data integrity maintained

## Team Notes

### Recent Decisions
- **D-0001:** RLS disabled globally for internal tool simplicity
- Seeding approach: Deterministic data for consistent testing
- Benchmark thresholds: P95 performance expectations set

### Architecture Notes
- Asset class structure follows existing assetClassGroups.js
- Fund ticker pattern: RJFA### for primary test data
- Performance data uses realistic but deterministic values
- All database operations use idempotent upserts

---

*This status dashboard is updated automatically during sprint activities and should reflect the current state of the baseline environment.*