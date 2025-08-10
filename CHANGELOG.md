## 2025-08-10

- Phase 3 kickoff: Saved View Defaults v1
  - Per-user defaults persisted via `preferencesService` (IndexedDB) using `authService.getCurrentUser()?.id || 'guest'`
  - `chartPeriod` value is now persisted and restored
  - Docs: added `PHASE3_PROGRESS.md`; linked from `PHASE2_PROGRESS.md`; updated `API_STATUS.md`

