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

### 2025-08-11

- Admin IA tabs in Fund Management: Data Uploads, Catalogs, Mappings, Scoring (placeholder), Utilities
- Snapshot Manager (Admin → Data Uploads)
  - Lists distinct `fund_performance.date` with row counts, newest first
  - Uses Postgres RPC `list_snapshot_counts()` with JS fallback when RPC unavailable
  - Delete month (confirm) cascades removal of that month’s rows only
  - Download monthly CSV template
- Monthly Snapshot Upload
  - Added required Month/Year picker; picker overrides CSV `AsOfMonth`
  - Non-EOM dates are auto-corrected to end-of-month
  - Legacy CSV with `AsOfMonth` still supported during transition
- Bulk seeders (Admin → Data Uploads)
  - Seed Recommended Funds (CSV headers: `Ticker,AssetClass,Name`): upsert funds, set `is_recommended=true`, resolve `asset_class_id` from canonical dictionary, skip invalid
  - Seed Benchmarks (CSV headers: `AssetClass,BenchmarkTicker,Name`): upsert benchmarks by ticker and set mapping in `asset_class_benchmarks` as primary (rank 1)
- CSV template service
  - Default template no longer includes `AsOfMonth`
  - Added legacy template generator including `AsOfMonth`

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
  - Compare view adds both horizons; Table and Compare CSV exports include “Std Dev (3Y)” and “Std Dev (5Y)”. Legacy import logs a console warning when mapping `standard_deviation` to 3Y.

### Fixed
- Fix Snapshot Manager query to use aggregate select; remove unsupported `.group()`.

### Added
- Admin Overview (setup checklist) with quick links and two exports.
- Seeder “Validate only” mode for Recommended Funds and Benchmarks.

