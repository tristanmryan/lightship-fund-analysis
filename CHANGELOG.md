## 2025-08-10

- Phase 3 kickoff: Saved View Defaults v1
  - Per-user defaults persisted via `preferencesService` (IndexedDB) using `authService.getCurrentUser()?.id || 'guest'`
  - `chartPeriod` value is now persisted and restored
  - Docs: added `PHASE3_PROGRESS.md`; linked from `PHASE2_PROGRESS.md`; updated `API_STATUS.md`

- Research Notes v1 (append-only, behind flag)
  - Supabase table `fund_research_notes` with append-only triggers
  - UI panel in Drilldown when `REACT_APP_ENABLE_NOTES=true`
  - Author recorded from interim auth service; RLS deferred until Supabase Auth

- Saved Compare Sets v1
  - `ComparisonPanel` toolbar to Save/Load/Delete named sets (4-fund limit)
  - Stored per-user in `preferencesService` under `compare_sets_v1`, case-insensitive names
  - Missing tickers skipped with notice; remote-first plan once Supabase Auth is live

- CSV Export v1
  - Table export: only visible rows/columns, honors current sort; metadata rows; UTF-8 BOM, CRLF; numerics raw; percent decimals
  - Compare export: requested metrics plus 1Y benchmark delta; metadata rows; UTF-8 BOM, CRLF; numerics raw; percent decimals

- Monthly Snapshot Upload (CSV) + As-of selector
  - Admin-only page (behind `REACT_APP_ENABLE_IMPORT`) to upload→preview→import monthly snapshots
  - Upsert into `fund_performance` keyed by (`fund_ticker`,`date`); unknown tickers skipped; non-EOM warns
  - Batching (~500 rows per upsert call) with summary results
  - Dashboard “As of” selector lists distinct months; switching clamps sparklines and updates all views; selection persisted

### Added
- Runtime Scoring (flagged): `REACT_APP_ENABLE_RUNTIME_SCORING`
  - When enabled (default true in dev), calculates scores at runtime for the current As-of month peer set (per asset class; benchmarks excluded).
  - Capture-field alignment (live up/down capture, standard_deviation to both stdDev3Y/stdDev5Y) included.
  - Added unit tests for runtime scoring behavior; CI green.
 - Scoring Quality: Std Dev Horizons
   - Schema: added `standard_deviation_3y` and `standard_deviation_5y` to `fund_performance`; `standard_deviation_3y` backfilled from legacy `standard_deviation` where present; `standard_deviation_5y` left null.
   - Importer & CSV template updated to prefer horizon-specific fields with legacy fallbacks (including aliases for alpha/beta and capture ratios with `_3y`).
   - Runtime scoring uses `standard_deviation_3y` and `standard_deviation_5y` directly; missing metrics trigger proportional reweighting.
   - Drilldown shows both Std Dev (3Y) and Std Dev (5Y) with em-dash when missing.

