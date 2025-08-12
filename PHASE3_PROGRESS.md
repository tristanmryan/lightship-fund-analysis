## Phase 3 Implementation Progress — Saved Views, Research Workflow, Compare Sets, Exports, YCharts Ingestion

### Title & Scope
- Phase 3 covers:
  - Saved Views (per-user view defaults & presets)
  - Research Workflow (notes/decision log per fund, audited, attachable to overrides)
  - Compare Sets (save/load named comparison groups)
  - Exports (CSV first; PDF later)
  - YCharts production ingestion (schedule, retries, surfaced errors in Health)

---

**Standing Reminder:** After every Phase 3-related PR is merged, update this file with:

- A new “Completed” bullet if a feature is finished, or move it from “In Progress.”
- Any new screenshots or screenshot references in `docs/screenshots/phase3/`.
- Updates to “Next Steps,” “Technical architecture,” “QA & Acceptance checklist,” and “Risks & mitigations” if they’ve changed.
- The PR link and date in the milestones table (if present).
- A corresponding entry in `CHANGELOG.md` and, if applicable, a note in `API_STATUS.md`.

---

### Completed Features
 - Saved View Defaults v1 using `preferencesService` (IndexedDB) with per-user namespace derived from `authService.getCurrentUser()?.id || 'guest'`.
 - `chartPeriod` is persisted and restored as part of the saved view.
 - Minimal unit tests added; all tests pass locally.
 - Research Notes v1 (append-only) behind `REACT_APP_ENABLE_NOTES` flag; interim author = `authService.getCurrentUser()?.id || 'guest'`.
 - Saved Compare Sets v1 in `ComparisonPanel` using `preferencesService` (`compare_sets_v1`), with Save/Load/Delete, 4-fund limit, case-insensitive names, and missing-ticker notice.
 - Runtime scoring per As-of month (flagged): `REACT_APP_ENABLE_RUNTIME_SCORING`
   - Computes Z-score–based scores at runtime for the current As-of month peer set (per asset class; benchmarks excluded), wiring added in `useFundData`.
   - Capture-field alignment implemented (live `up_capture_ratio`/`down_capture_ratio` and CSV “Up/Down Capture (… Ratio)”) to engine inputs.
   - Tests added: runtime scoring unit tests (Sharpe/expense effects, capture mapping, as-of recompute concept); CI passing.
 - Compare view shows Std Dev (3Y) and Std Dev (5Y). Both Table CSV and Compare CSV exports include “Std Dev (3Y)” and “Std Dev (5Y)”. Legacy import triggers a console warning when mapping `standard_deviation` → `standard_deviation_3y`.
 - Admin IA tabs: Data Uploads, Catalogs, Mappings, Scoring (placeholder), Utilities.
 - Snapshot Manager: lists distinct `fund_performance.date` with row counts, supports delete with confirm, and per-month template download.
  - Snapshot Manager: now uses a Postgres RPC (`list_snapshot_counts`) for grouped counts with a JS fallback; function added to schema files.
 - Monthly Snapshot Upload: Month/Year picker added (required). Picker overrides CSV `AsOfMonth`; non-EOM dates auto-corrected to EOM. Legacy CSV still supported.
 - Bulk seeders: Seed Recommended Funds and Seed Benchmarks (CSV). Headers:
   - Recommended: `Ticker,AssetClass,Name`
   - Benchmarks: `AssetClass,BenchmarkTicker,Name`
 - CSV template: default template excludes `AsOfMonth`; legacy template available.
  - Admin Overview (setup checklist) added with export buttons; shows asset classes, mapping coverage, recommended funds, and snapshots summary.
  - Seeders now support "Validate only (no writes)" dry-run mode.
  - Catalogs: added canonical asset class "Mid-Cap Blend" (code `MID_CAP_BLEND`, U.S. Equity, sort_order 220) with default primary benchmark mapping to `IWR` (iShares Russell Mid-Cap ETF).

### In Progress
- Research workflow: schema and UI spec (notes + decision log; audited; linked to overrides).
- PDF exports to follow.
- YCharts ingestion: job schedule + retry policy + Health surfacing.
 - Monthly Snapshot Upload (CSV) + As-of selector: implemented behind `REACT_APP_ENABLE_IMPORT`; Admin-only page for upload→preview→import (idempotent upsert on (fund_ticker,date)), unknown tickers skipped, non-EOM warns; dashboard selector lists distinct months and clamps sparklines. Added "Download CSV Template" button on the importer.

### Next Steps (Prioritized)
1) Research workflow MVP (notes/decision log per fund; audit trail; attach to overrides).
2) Compare sets (local per-user first; design shared model).
3) CSV exports (table + compare) — Completed.
4) Server-side Saved Views with Supabase RLS once Supabase Auth is in the UI; keep IndexedDB as offline cache.
5) YCharts production ingestion (schedule, retries, error surfacing in Health).

### Technical Architecture

#### Data Model Changes & RLS
- Deferred until Supabase Auth is in the UI for user identity:
  - `user_preferences` (user_id uuid, key text, value jsonb, updated_at timestamptz, PK (user_id, key)); RLS: user_id = auth.uid().
  - `compare_sets` (user_id, name text, tickers text[], updated_at); RLS similar.
  - `fund_research_notes` (id, fund_id, author_id, note text, decision text, created_at); RLS per author and org roles.
- Current storage: IndexedDB `preferences` store via `preferencesService`.

#### Client Integration Points
- `preferencesService` for get/save of `view_defaults_v1`, `filter_presets_v1`, and future `compare_sets_v1`.
- `EnhancedPerformanceDashboard` loads/applies/saves defaults, including `chartPeriod`.
- `AdvancedFilters` accepts initial filters and persists per-user presets.
- `EnhancedFundTable` accepts initial sort/columns and reports state changes.
- `ComparisonPanel` will integrate with compare sets.
- Health view to show YCharts ingestion status/errors (later step).

#### Data Dictionary (selected fields)
- fund_performance:
  - `standard_deviation` (deprecated)
  - `standard_deviation_3y` (preferred standard deviation horizon for 3Y)
  - `standard_deviation_5y` (preferred standard deviation horizon for 5Y)
  - `sharpe_ratio` (3Y), `alpha` (5Y; alias: `alpha_5y` accepted), `beta` (3Y; alias: `beta_3y` accepted)
  - `up_capture_ratio`/`down_capture_ratio` (3Y; aliases `*_3y` accepted)

#### Feature Flags
- `REACT_APP_ENABLE_SAVED_VIEWS` (default true in dev; keep OFF in prod until QA completes).
- Existing (unchanged in prod):
  - `REACT_APP_RESOLVER_SUPABASE_FIRST=true`
  - `REACT_APP_ENABLE_CONFIG_BENCHMARK_FALLBACK=false`
  - `REACT_APP_ENABLE_ADMIN_MANUAL_ADD=false`

### Environment
- Local: use `.env.local` with `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_ANON_KEY` (alias `REACT_APP_SUPABASE_ANON` also supported). The status script auto-loads `.env.local`/`.env`.
- Vercel: set `REACT_APP_SUPABASE_URL` and the anon key as `REACT_APP_SUPABASE_ANON_KEY` (or `REACT_APP_SUPABASE_ANON`). `_ANON_KEY` is preferred.

### QA & Acceptance Checklist
- On reload, filters, columns, sort, and `chartPeriod` restore for the user.
- Changing those updates the default transparently.
- No regressions in Drilldowns, Compare, or sparklines.
- CSV Export:
  - Table export includes only visible columns/rows and honors current sort; metadata present; UTF-8 BOM+CRLF; numbers unformatted; percent decimals.
  - Compare export includes requested metrics and 1Y benchmark delta when available; metadata present; UTF-8 BOM+CRLF; numbers unformatted; percent decimals.
- Limitation documented: placeholder user IDs mean all logged-in users share the same defaults until Supabase Auth is adopted.
- Monthly Snapshot Upload: Month/Year picker required; picker overrides CSV dates; upload→preview shows counts, first 20 rows, skip reasons, EOM warnings; import batches (~500) and summarizes parsed/imported/skipped with month used; re-import same month updates rows.
- Snapshot Manager lists months with counts; delete works with confirmation; template downloads.
- Seeders import valid rows, skip invalid, and summarize results; asset class validated from canonical list.

### Screenshots
- Saved Views (placeholder): `docs/screenshots/phase3/saved_views.png`
 - Research Notes (placeholder): `docs/screenshots/phase3/research_notes.png`

### Migration Sequence (if any)
1) Keep using IndexedDB (local) for preferences now.
2) After Supabase Auth lands, add remote-first preferences with RLS, migrating local values on first login.
3) Continue using IndexedDB as an offline cache.

### Risks & Mitigations
- No per-user identity in UI yet → Everyone shares defaults in current auth model; document and plan Supabase Auth before server-side prefs.
- Local storage corruption → defaults fall back to safe initial state; saving rehydrates.
- API rate/caching for YCharts ingestion → schedule, retries, and serverless limits.
- RLS misconfiguration later → add staging environment tests and health checks.

### Success Metrics
- Defaults restore consistently across reloads.
- 0 regressions in Drilldowns/Compare/sparkline tests.
- Export times under target; Health shows ingestion errors clearly.

### Testing Notes
- Unit tests cover Saved View Defaults v1 (including `chartPeriod`).
- Manual QA: toggle `chartPeriod`, adjust filters/columns/sort, refresh, verify state restoration and no UI regressions.

### Operational Runbooks

#### Data Onboarding Runbook

Follow these steps to seed a new environment safely.

1) Verify readiness in Admin Overview
- Open Admin → Fund Management. Review “Admin Overview” at the top:
  - Asset Classes count
  - Benchmark Mapping coverage (X/Y, unmapped)
  - Recommended Funds count (and any without asset_class_id)
  - Snapshots latest month

2) Seed Recommended Funds
- Prepare CSV with headers: `Ticker,AssetClass,Name`
- In “Seed Recommended Funds”:
  - Click “Download Template” to confirm headers
  - Upload CSV → click “Parse”
  - Check “Validate only (no writes)” → click “Import” to review summary
  - Uncheck “Validate only” → click “Import” to apply

3) Seed Benchmarks (Primary mapping)
- Prepare CSV with headers: `AssetClass,BenchmarkTicker,Name`
- In “Seed Benchmarks”:
  - “Download Template” → upload CSV → “Parse”
  - “Validate only (no writes)” → “Import” to review
  - Uncheck “Validate only” → “Import” to apply

4) Upload Monthly Snapshot
- Use “Monthly Snapshot Upload (CSV)”
- Month/Year picker is required; it overrides any CSV dates
- Use the default template (no `AsOfMonth` column)
- Parse → review preview (EOM warnings, skipped rows) → Import

5) Verify
- Admin Overview shows updated counts and coverage
- Snapshot Manager lists the new month with row count
- Compare and Drilldown views load with the selected As-of month

6) Rollback tips
- Undo a snapshot month:
  - Admin → Snapshot Manager → Delete for that YYYY-MM-DD
- Undo Recommended Funds import:
  - Use your CSV tickers; either toggle off or clear mapping:
    - Set not recommended: 
      `update public.funds set is_recommended = false where ticker in ('TICK1','TICK2',...);`
    - Clear asset class link if needed:
      `update public.funds set asset_class_id = null where ticker in ('TICK1','TICK2',...);`
    - Optionally delete funds created only by the seed (if known by timestamp):
      `delete from public.funds where ticker in ('TICK1','TICK2',...) and created_at >= 'YYYY-MM-DD';`
- Undo primary benchmark mappings:
  - Remove primary mappings for specific classes (by name list):
    `delete from public.asset_class_benchmarks using public.asset_classes ac
      where asset_class_benchmarks.asset_class_id = ac.id
        and asset_class_benchmarks.kind = 'primary'
        and ac.name in ('Class A','Class B',...);`

#### Data Diagnostics & Backfill
- Admin → Fund Management → Utilities → Data Diagnostics:
  - Shows quick counts (total, recommended, missing asset_class_id, unmapped U.S. Equity, snapshot months)
  - Export CSV of funds missing asset_class_id
  - Backfill asset_class_id from legacy name match (case-insensitive):
    - Validate only (no writes): preview how many would update
    - Live backfill: updates rows and refreshes counts
  - Production guard: set `REACT_APP_ALLOW_ADMIN_WRITES=true` to enable live writes when `NODE_ENV=production`. Otherwise, the backfill button is disabled.

