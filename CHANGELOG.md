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

