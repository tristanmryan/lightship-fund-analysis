# Architecture and Implementation Decisions

This document tracks key architectural and implementation decisions for the Lightship Fund Analysis application.

## Decision Format

Each decision follows this format:
- **ID**: Unique identifier (D-XXXX)
- **Date**: Decision date
- **Status**: Draft | Active | Superseded
- **Context**: Why this decision was needed
- **Decision**: What was decided
- **Consequences**: Implications and trade-offs

---

## D-0001 - RLS Disabled for Internal Tool Simplicity
- **Date**: 2025-01-15
- **Status**: Active
- **Context**: Backend analysis revealed critical inconsistencies in Row Level Security (RLS) policies across tables, which would block Sprint 0 bench harness development. As an internal tool for investment committees, complex access controls add unnecessary complexity.
- **Decision**: Disable RLS globally across all Supabase tables and rely on anon role with SELECT grants for data access.
- **Consequences**: 
  - ✅ Simplified data access patterns
  - ✅ Faster development and debugging
  - ✅ Consistent behavior across all tables
  - ❌ Less granular security controls
  - ❌ Future multi-tenant features will require RLS re-implementation

## D-0002 - Asset Class Benchmark Uniqueness Constraint
- **Date**: 2025-01-15  
- **Status**: Active
- **Context**: The bench harness requires exactly one primary benchmark per asset class, but the database allowed multiple primary benchmarks which would cause ambiguous results.
- **Decision**: Added unique index `idx_acb_primary_unique ON asset_class_benchmarks(asset_class_id) WHERE kind='primary'` to enforce the constraint.
- **Consequences**:
  - ✅ Prevents data integrity issues with benchmark resolution
  - ✅ Clear error when attempting to add duplicate primary benchmarks
  - ✅ Supports the bench harness requirements
  - ❌ Requires migration of any existing duplicate data

## D-0003 - Core RPC Suite for Bench Harness
- **Date**: 2025-01-15
- **Status**: Active  
- **Context**: Sprint 0 bench harness requires 6 core database functions to operate without errors. These RPCs provide the foundation for the performance dashboard and scoring system.
- **Decision**: Implemented 6 core RPCs with basic functionality:
  - `get_active_month(p_hint)` - EOM-preferred date resolution
  - `get_asset_class_table(p_date, p_asset_class_id, p_include_benchmark)` - Fund table with benchmark rows
  - `get_scores_as_of(p_date, p_asset_class_id, p_limit, p_after)` - Placeholder for scoring (returns nulls)
  - `get_compare_dataset(p_date, p_tickers)` - Comparison data with benchmark deltas
  - `get_history_for_tickers(p_tickers, p_to)` - Batched historical data to eliminate N+1 queries
  - `refresh_metric_stats_as_of(p_date)` - Placeholder for scoring refresh
- **Consequences**:
  - ✅ Bench harness can run without database errors
  - ✅ Foundation for future scoring system implementation
  - ✅ Eliminates N+1 query patterns in historical data
  - ✅ Consistent data access patterns
  - ❌ Some functions return placeholder data until full scoring implementation
  - ❌ Additional complexity in database schema

## D-0004 - Sprint 0 Baseline Environment Established
- **Date**: 2025-01-15
- **Status**: Active
- **Context**: Sprint 0 required a complete baseline measurement environment with deterministic test data, verification scripts, and performance benchmarking to establish foundation for future development sprints.
- **Decision**: Created comprehensive baseline environment including:
  - Deterministic seed scripts with 32 asset classes, 28 benchmarks, 120 funds (RJFA001-RJFA120)
  - 12 months of EOM performance data (2024-08-31 to 2025-07-31)
  - Verification script for data integrity checks
  - Benchmark harness testing all 6 RPCs with concurrency levels 1 and 5
  - Status tracking documentation framework
  - Package.json scripts for easy workflow management
- **Consequences**:
  - ✅ Reproducible baseline environment for consistent testing
  - ✅ Performance benchmarks establish optimization targets
  - ✅ Automated verification prevents regression issues
  - ✅ Foundation ready for Sprint 1 development
  - ✅ Clear performance thresholds documented
  - ❌ Test data may not represent full production complexity
  - ❌ Benchmark thresholds are conservative and require optimization

---

## Implementation Notes

### Migration Sequence
1. `20250815_disable_rls.sql` - Disables RLS globally and ensures anon grants
2. `20250815_core_rpcs.sql` - Adds missing index and 6 core RPCs

### Rollback Strategy
Each migration includes rollback instructions in comments. RLS can be re-enabled by running the inverse operations and recreating policies as needed.

### Baseline Environment Scripts
Added to package.json:
- `npm run seed` - Idempotent deterministic data seeding
- `npm run verify` - Comprehensive database integrity checks  
- `npm run bench` - RPC performance testing (Mode A: 120 funds)
- `npm run bench:full` - Full benchmark suite (Mode A + B: 520 funds, concurrency 5,1)

### Future Decisions
- Scoring system implementation (full algorithm in database vs. client)
- Multi-tenant architecture when expanding beyond internal use
- Performance optimization strategies for large datasets
- Sprint 1 performance threshold adjustments based on baseline results