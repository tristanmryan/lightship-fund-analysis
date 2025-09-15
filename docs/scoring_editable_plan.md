# Editable Scoring Methodology — Implementation Plan

Owner: Tristan + Codex
Last updated: 2025-09-15

## Objectives

- Single, client‑side scoring method across the app.
- Editable scoring in the Scoring tab: add/remove metrics and adjust weights.
- Limit metrics to those present in the fund/benchmark performance dataset (not holdings/trading).
- Intuitive UX with real-time preview and clear guardrails (coverage, direction, totals).
- Decommission legacy scoring code once the new flow is validated.

## Summary of Approach

1) Persist zero weights so “drop metric” is an explicit, saved override.
2) Centralize metric registry (keys, labels, categories, directions) so scoring + UI stay in sync.
3) Expand the clean scoring engine to include all CSV-backed metrics with proper directions.
4) Enhance Scoring tab: metric selector limited by availability + per-class coverage; live preview remains.
5) After saving, allow a quick app-level refresh so scores elsewhere reflect changes.
6) Stage removal of `src/services/scoring.js` and related unused code following verification.

## High-Level Checklist

- [x] Enable zero-weight persistence in weight storage (drop the “non-zero only” filter)
- [x] Centralize metric registry (labels, categories, isHigherBetter) used by both UI and scoring
- [x] Expand `scoringService.js` metrics + directions to cover all CSV metrics
- [x] Implement metric selector in Scoring tab with per-asset-class coverage
- [x] Show direction + coverage badges; keep weight sum and validation warnings
- [x] Save/Reset flows: persist zeros and allow revert to global defaults
- [x] Hook save completion to prompt global rescoring/refresh (CTA-only banner: “Apply new scoring to app”)
- [x] Verify all consumers use the clean scoring engine
- [x] Deprecate and remove `src/services/scoring.js` and unused resolvers/profiles
- [x] Update docs/tests; remove dead code and references

## Scope & Constraints

- Metrics included: Those present in the fund/benchmark performance tables (e.g., returns, Sharpe, std dev 3y/5y, expense ratio, alpha, beta, up/down capture, manager tenure). Holdings/trading are out of scope.
- Scoring remains peer-relative within asset class (z-score normalization + weighted sum -> 0–100 scale).
- Real-time preview remains in Scoring tab; broader app uses the same engine on next data refresh.

## Data Model / Storage

- Table: `scoring_weights_simple`
  - Columns: `asset_class_id`, `metric_key`, `weight`
  - Decision: Persist zero weights to explicitly disable metrics (no schema changes needed).

### Changes

- Remove the “only store non-zero weights” filter in `saveAssetClassWeights` so zero weights are stored.
- Ensure `getWeightsForAssetClass` and `getBulkWeightsForAssetClasses` return zeros as overrides (don’t reapply defaults over zero).

## Metric Registry (Single Source of Truth)

- Create or consolidate a registry describing every supported metric:
  - key: e.g., `one_year_return`
  - label: e.g., `1-Year Return`
  - category: `Returns | Risk | Cost | Others`
  - direction: `isHigherBetter: true/false`
  - optional: description, default weight

- Consumers:
  - `scoringService.js`: direction + defaults
  - Scoring tab UI (`WeightSliders.jsx` and metric selector)
  - Validations (direction badges, coverage warnings)

## Scoring Engine (Clean, Client-Side)

- Ensure `scoringService.js` covers all CSV metrics with correct directions:
  - Returns: ytd, 1y, 3y, 5y, 10y — higher is better
  - Risk: sharpe_ratio (higher), standard_deviation_3y/5y (lower), up_capture_ratio (higher), down_capture_ratio (lower)
  - Cost: expense_ratio (lower)
  - Other: alpha (higher), beta (lower), manager_tenure (higher)
- Iterate over the active weights set so added metrics participate when non-zero.

## Scoring Tab UX

- Metric selector (add metric):
  - List only metrics available in the selected asset class (non-null presence across funds).
  - Show coverage badge (e.g., `78% coverage`).
  - On add: set an initial default weight (or prompt) and include slider.

- Remove metric:
  - UI toggles off; set weight to 0 and persist.

- Slider list:
  - Group by category; show label, short description, direction badge, coverage, diff vs default, and the slider.
  - Keep weight sum indicator and warnings.

- Save/Reset:
  - Save persists per-asset-class overrides (including zeros).
  - Reset removes overrides (deletes rows) and falls back to global defaults.

- Post-save refresh:
  - Decision: CTA-only. Show a banner/toast with “Apply new scoring to app”. Clicking applies a global rescore/reload.

## Removal of Legacy Scoring

- Audit references to `src/services/scoring.js` (advanced engine) and related modules:
  - `scoringProfilesService`, `resolvers/scoringWeightsResolver.js`, Admin ScoringWeights component.
  - Migrate or remove any lingering fallback paths (e.g., `useFundData` legacy fallback) to rely solely on the clean engine.
- Remove unused code once the new flow is validated in app.

## Acceptance Criteria

- Scoring tab allows adding/removing metrics restricted to CSV-backed metrics.
- Zero-weight overrides persist and survive reloads.
- Directions (higher/lower) are correct; coverage is visible; warnings are clear.
- Dashboard, Recommended, and Reports reflect changes after refresh.
- No remaining runtime dependency on `src/services/scoring.js`.

## Risks & Mitigations

- Inconsistent metric definitions between UI and engine
  - Mitigation: Single registry imported by both layers.
- Confusion on immediate vs deferred scoring updates across app
  - Mitigation: Clear post-save CTA; optional auto-refresh flag.
- Removing legacy code too soon
  - Mitigation: Stage removal after verification; keep a short deprecation window.

## Work Breakdown (Detailed Tasks)

1) Zero-weight persistence
   - [x] Update `saveAssetClassWeights` to store zero weights
   - [x] Verify `getWeightsForAssetClass` and bulk loader return zeros as overrides
   - [x] Update validation to accept zeros

2) Metric registry
   - [x] Create `metricsRegistry` or consolidate in `scoringService.js`
   - [x] Define labels, categories, directions, descriptions
   - [x] Export defaults for reuse in UI (diff vs default)

3) Scoring engine updates
   - [x] Add missing metrics + directions to `scoringService.js`
   - [x] Ensure z-score & weighted sum iterate over active weights
   - [x] Add `getMetricCoverage(funds, assetClass)` helper

4) Scoring tab UI
   - [x] Replace hardcoded metrics in `WeightSliders.jsx` with registry
   - [x] Add metric selector listing only available metrics with coverage
   - [x] Show direction + coverage badges in rows
   - [x] Save/Reset flows persist zeros; revert to defaults

5) Refresh integration
   - [x] On save success, provide CTA to rescore/refresh
   - [x] Optional: emit app event to trigger refresh automatically

6) Legacy removal
   - [x] Audit usages of `src/services/scoring.js` and related modules
   - [x] Remove fallback references (e.g., `useFundData` legacy branch)
   - [x] Delete unused files; update imports/tests

7) Documentation & tests
   - [x] Update docs for scoring method & UI
   - [x] Adjust or add unit tests covering weight persistence and registry

## Decisions

- Post-save refresh: CTA-only banner with action to apply globally. [Decided]
- Presets: Skip for now; do not surface presets in UI. [Decided]

## Notes / Running Log

- Use this section to record small implementation details and deviations as they occur.
  - 2025-09-15: Locked decisions — CTA-only post-save refresh; skip scoring presets.
  - 2025-09-15: Implemented zero-weight persistence in `weightService`; now storing zeros as explicit overrides.
  - 2025-09-15: Added centralized metric registry `src/services/metricsRegistry.js`; wired into `scoringService` and `WeightSliders`.
  - 2025-09-15: Updated `scoringService` to consume registry; extended to include CSV-backed metrics.
  - 2025-09-15: Added CTA banner to Scoring tab after Save and a global listener in `useFundData` to apply new scoring without a full data reload.
  - 2025-09-15: Added Add‑Metric control with per‑class coverage and disabled‑metric quick action; sliders now show only enabled metrics.
  - 2025-09-15: Removed legacy fallback usage of `src/services/scoring.js` from `useFundData`; no runtime dependency remains.
  - 2025-09-15: Deleted legacy scoring engine and admin artifacts; removed leftover imports from `src/App.jsx`. Verified consumers use `scoringService` + `metricsRegistry`. Added tests for zero-weight persistence, coverage filtering, and CTA apply.
