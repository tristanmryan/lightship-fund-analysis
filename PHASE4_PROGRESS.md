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

