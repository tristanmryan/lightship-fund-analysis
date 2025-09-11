# PR Draft: Phase 4 — Scoring UX and Governance

## Summary
Implements governed scoring weights with profiles, precedence resolver (fund → asset class → global → defaults), Admin Weights editor (Global/Class/Fund with Preview), runtime integration to read effective weights, and tests. Adds a Drilldown Score display. No math changes; reweighting preserved.

## File map
- Schema/migrations
  - `supabase/migrations/20250812_phase4_scoring.sql`
  - `supabase/manual/scoring_phase4.sql`
- Services/Resolver
  - `src/services/supabase.js` (add scoring tables to `TABLES`)
  - `src/services/scoringProfilesService.js`
  - `src/services/resolvers/scoringWeightsResolver.js`
- Scoring pipeline & data loader
  - `src/services/scoring.js` (resolver integration; optional override param)
  - `src/hooks/useFundData.js` (load resolver before scoring)
- Admin UI
  - `src/components/Admin/ScoringWeights.jsx` (editor, staged edits, inspector)
  - `src/components/Admin/FundManagement.jsx` (wire tab)
- UI surfacing
  - `src/components/Dashboard/DrilldownCards.jsx` (Score row)
- Env/Docs
  - `env.example` (+ `REACT_APP_SCORING_PROFILE`)
  - `PHASE4_PROGRESS.md` (scope, schema, admin, runtime, tests, promote to prod, manual test log)
  - `CHANGELOG.md` (Phase 4 entry)
- Tests
  - `src/__tests__/scoringWeightsResolver.test.js`
  - `src/__tests__/scoring.integration.test.js`
  - `src/services/__tests__/export.table.stddev.test.js` (existing)
  - `src/services/__tests__/export.table.score.test.js` (new)

## Migration notes
- Run locally only for testing: `supabase/manual/scoring_phase4.sql`
- Creates: `scoring_profiles`, `scoring_weights`, `scoring_weights_audit`
- Adds trigger `scoring_weights_audit_trg` and index `one_default_scoring_profile`
- Seeds `Default` profile with weights matching `DEFAULT_WEIGHTS`

## Test notes
- Resolver precedence unit test
- Integration: resolver weight changes influence scores; reweighting remains active
- Export: table CSV writes `Score` as plain number with one decimal (not percent)

## Acceptance checklist
- [ ] Default profile exists and is used when `REACT_APP_SCORING_PROFILE` unset
- [ ] Editing weights in Admin → Scoring updates scores after refresh across Table, Compare, Drilldown
- [ ] Compare CSV includes Score; Table export includes visible Score as number (one decimal)
- [ ] Audit table captures all changes
- [ ] Dev-only Inspector shows effective weights

## Suggested commit message
Phase 4: Scoring governance + Admin Weights editor + resolver integration + tests; add Drilldown Score; seed schema and audit; docs and env updates

