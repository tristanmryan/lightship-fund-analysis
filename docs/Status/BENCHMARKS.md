# Performance Benchmarks

**Purpose:** Track RPC performance baselines and identify optimization opportunities  
**Last Updated:** 2025-01-15  
**Sprint:** Sprint 0 - Baseline Environment

## Benchmark Overview

This document tracks performance measurements for the 6 core RPCs that support the bench harness. Benchmarks are run with deterministic test data to ensure consistent measurement conditions.

### Test Configuration

#### Mode A: Basic (120 funds)
- **Funds:** RJFA001-RJFA120
- **Use Case:** Standard dashboard operations
- **Data Size:** ~1,440 performance records

#### Mode B: Extended (520 funds)  
- **Funds:** RJFA001-RJFA120 + RJX001-RJX400
- **Use Case:** Large portfolio analysis
- **Data Size:** ~6,240 performance records

#### Concurrency Levels
- **Level 1:** Single-threaded (baseline)
- **Level 5:** High concurrency (realistic load)

## Performance Thresholds

### P95 Response Time Targets (Sprint 0)

| RPC | Basic Target | Extended Target | Notes |
|-----|--------------|-----------------|-------|
| `get_active_month` | 100ms | 100ms | Simple date lookup |
| `get_asset_class_table` | 500ms | 800ms | Complex joins with benchmarks |
| `get_compare_dataset` | 300ms | 600ms | Fund comparison queries |
| `get_scores_as_of` | 400ms | 700ms | Scoring calculations |
| `get_history_for_tickers` | 600ms | 1000ms | Historical data aggregation |
| `refresh_metric_stats_as_of` | 1000ms | 1500ms | Statistical computations |

*Note: These are baseline targets for Sprint 0. Performance optimization will occur in subsequent sprints.*

## Benchmark Results

### 🚀 To Run Benchmarks

```bash
# Basic benchmark (Mode A, concurrency 5)
npm run bench

# Full benchmark (both modes, concurrency 5,1)
npm run bench:full

# Custom benchmark
npm run bench -- --mode=extended --concurrency=1,3,5
```

### 📊 Latest Results

*Results will appear here after first benchmark run*

**Status:** ⏳ Awaiting first benchmark execution  
**Command:** `npm run bench:full`  
**Expected Output:** `bench/results/benchmark_[timestamp].md`

## Performance Analysis Framework

### Metrics Tracked
- **P50 (Median):** Typical response time
- **P95:** 95th percentile response time (SLA target)
- **P99:** 99th percentile response time (outlier detection)
- **Mean:** Average response time
- **Error Rate:** Failed requests percentage

### Success Criteria
1. **Error Rate:** < 1% for all RPCs
2. **P95 Compliance:** Within threshold targets
3. **Stability:** Consistent performance across runs
4. **Scalability:** Reasonable degradation from Mode A to Mode B

### Failure Investigation
When benchmarks fail or exceed thresholds:
1. Check RPC implementation for optimization opportunities
2. Analyze database query plans
3. Consider indexing improvements
4. Review data size impact
5. Evaluate concurrency handling

## Historical Tracking

### Sprint 0 Baseline
- **Target:** Establish performance baselines
- **Focus:** Identify immediate optimization needs
- **Threshold:** Functional performance (not optimized)

### Future Sprint Goals
- **Sprint 1:** Optimize worst-performing RPCs
- **Sprint 2:** Scale testing with production-like data
- **Sprint 3:** Performance regression testing

## Quick Reference

### Benchmark Command Examples
```bash
# Quick verification
npm run bench -- --mode=basic --concurrency=1

# Load testing
npm run bench -- --mode=extended --concurrency=5

# Performance regression test
npm run bench:full
```

### Files Generated
- `bench/results/benchmark_[timestamp].md` - Detailed results
- Automatic P95 threshold analysis
- Error rate reporting
- Performance recommendations

---

*Benchmark results are automatically timestamped and versioned for historical analysis.*