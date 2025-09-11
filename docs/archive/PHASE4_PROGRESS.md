# Phase 4 — Scoring UX and Governance

Scope: Introduce governed scoring weights (profiles), Admin weights editor, precedence resolver, runtime integration, and tests.

Acceptance
- Default profile exists and is used automatically.
- Editing a weight updates Scores in Table, Compare, and Drilldown after refresh.
- Compare CSV includes Score; Table export includes Score when visible.
- Audit table captures all weight changes.

Schema changes (Supabase)
- Tables: `scoring_profiles`, `scoring_weights`, `scoring_weights_audit`.
- Trigger: `scoring_weights_audit_trg` using `scoring_weights_audit_fn`.
- Index: partial unique `one_default_scoring_profile` to ensure a single default.
- Seed: `Default` profile with weights matching `DEFAULT_WEIGHTS` exactly.

Admin UI notes
- New Admin tab “Scoring” with tabs: Global, Class, Fund, Preview.
- Global: edit weights for all metrics.
- Class/Fund: inline add/edit/remove, toggle via presence/removal.
- Preview: pick an asset class and up to 4 funds, recompute client-side.

Runtime resolver notes
- Resolver reads active profile by `REACT_APP_SCORING_PROFILE` (id or name) or profile with `is_default=true`.
- Precedence: fund → asset_class → global → baked-in defaults.
- Resolver loaded once per refresh; scoring math unchanged; reweighting preserved.

Testing steps
1) Run local migrations (manual):
   - psql against local dev DB with `supabase/manual/scoring_phase4.sql`.
   - Or apply idempotent migration in `supabase/migrations/20250812_phase4_scoring.sql`.
2) Start app with `REACT_APP_ENABLE_RUNTIME_SCORING=true`.
3) Verify Table, Compare, and Drilldown show Scores.
4) In Admin → Scoring, change a global weight (e.g., `expenseRatio` more negative), save, refresh; verify scores shift.
5) Add an asset class override and verify only that class changes.
6) Add a fund override and verify only that fund changes.

Manual migration run
- Apply only to local dev DB. Do not apply to remote.
- Script: `supabase/manual/scoring_phase4.sql` (idempotent).

Backout plan
- Roll back by ignoring resolver (set `REACT_APP_ENABLE_RUNTIME_SCORING=false`) to freeze UI.
- Optionally drop `scoring_weights` rows or reset to seed values.

Known constraints
- `asset_class` overrides keyed by canonical class name; can later migrate to IDs.
- Fund overrides use cleaned ticker symbols.
- Preview is client-only and uses current in-memory data; refresh to reflect persisted changes app-wide.

Importer guardrails
- Added robust `parseMetricNumber` to normalize CSV metrics: trims, strips %, handles parentheses negatives, recognizes '-', '—', 'NA', 'N/A', '' as null; never coerces non-numeric to 0.
- Wired into all performance writes (single and bulk) to `public.fund_performance`.
- Import preview shows header recognition (recognized → column, and unrecognized lists), computes coverage per metric, blocks import if a required metric would be all-null after parsing, and warns when coverage < 20%.

Importer diagnostics
- Preview header now surfaces two chips: `Funds to import: N` and `Benchmarks to import: M`.
- Added a diagnostic-only box “Skipped rows by reason” listing counts and first 10 tickers for each reason. Console logs mirror this summary.
- Benchmarks are recognized in preview and skipped for fund import (stored separately; see below).

Benchmark performance (store only)
- New table `public.benchmark_performance` mirrors `fund_performance` and is keyed by `unique(benchmark_ticker, date)`. Idempotent migration added under `supabase/migrations/20250813_benchmark_performance.sql`.
- Importer routes rows: if ticker is a benchmark, writes to `benchmark_performance`; if ticker is a fund, writes to `fund_performance`; if neither, lists under skipped unknowns. Read paths unchanged.

Asset-class counters
- Unified counting logic to use `asset_class_id` when present, falling back to `asset_class_name` (or legacy label). "Unknown" is strictly when both id is null and name is empty. Applied to dashboard summary and heatmap grouping to match the table.

Promote to prod
- Run `supabase/manual/scoring_phase4.sql` against production database.
- Set or confirm `REACT_APP_SCORING_PROFILE` (id or name) if a non-default profile should be targeted.
- Deploy the application and verify weights load (Admin → Scoring) and Scores render in Table, Compare, and Drilldown.

Manual test log (clicks executed locally)
- Admin → Scoring → Global: adjusted `expenseRatio` to `-0.050`, clicked out to save, refreshed app; Table scores decreased as expected.
- Admin → Scoring → Class: selected `Large Cap Growth`, set `oneYear` to `0.200`, saved; only LCG funds shifted on refresh.
- Admin → Scoring → Fund: searched `SPY`, set its `oneYear` to `0.300`, saved; SPY score increased relative peers on refresh.
- Admin → Scoring → Preview: selected 3 funds in `Asset Allocation`; changed staged `stdDev3Y`; preview updated immediately.

Reset and Reseed
- Reset Fund Catalog: deletes ALL rows in `public.funds`. Snapshots in `public.fund_performance` are not touched.
- Reset Benchmarks Catalog: deletes ALL rows in `public.benchmarks` and ALL mappings in `public.asset_class_benchmarks`.
- Manual SQL used (idempotent):
  - Schema/migrations in `supabase/manual/scoring_phase4.sql` and `supabase/migrations/20250812_phase4_scoring.sql`.
- Verify checklist:
  1) Export both catalogs (buttons provided) before destructive actions.
  2) Run Reset Benchmarks; confirm `benchmarks` and `asset_class_benchmarks` are empty.
  3) Run Seed All: Dry-run first, then Import (Benchmarks → Recommended Funds).
  4) Refresh app; counts reflect reseeded catalogs; Scores render without errors.