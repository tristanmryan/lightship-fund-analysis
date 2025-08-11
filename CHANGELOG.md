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

