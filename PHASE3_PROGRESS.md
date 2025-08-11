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

#### Feature Flags
- `REACT_APP_ENABLE_SAVED_VIEWS` (default true in dev; keep OFF in prod until QA completes).
- Existing (unchanged in prod):
  - `REACT_APP_RESOLVER_SUPABASE_FIRST=true`
  - `REACT_APP_ENABLE_CONFIG_BENCHMARK_FALLBACK=false`
  - `REACT_APP_ENABLE_ADMIN_MANUAL_ADD=false`

### QA & Acceptance Checklist
- On reload, filters, columns, sort, and `chartPeriod` restore for the user.
- Changing those updates the default transparently.
- No regressions in Drilldowns, Compare, or sparklines.
- CSV Export:
  - Table export includes only visible columns/rows and honors current sort; metadata present; UTF-8 BOM+CRLF; numbers unformatted; percent decimals.
  - Compare export includes requested metrics and 1Y benchmark delta when available; metadata present; UTF-8 BOM+CRLF; numbers unformatted; percent decimals.
- Limitation documented: placeholder user IDs mean all logged-in users share the same defaults until Supabase Auth is adopted.
 - Monthly Snapshot Upload: upload→preview shows counts, first 20 rows, skip reasons, EOM warnings; import batches (~500) and summarizes parsed/imported/skipped with months used; re-import same month updates rows.
 - As-of selector: switching month updates table, compare, drilldowns; sparklines clamp to selected month; “Latest” uses most recent date in `fund_performance`.

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

