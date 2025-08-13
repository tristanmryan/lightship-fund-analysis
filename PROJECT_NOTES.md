# Scoring Model Enhancement Plan and Progress Notes

This document logs the plan and ongoing progress to enhance the scoring model implementation.

## Goals
- Improve stability and fairness of scores across asset classes and time.
- Make outlier handling and missing data behavior explicit and tunable.
- Increase transparency (coverage, weight provenance, small-sample behavior).

## Phased Plan

### Sprint A (P0/P1)
- Coverage-aware weighting: per asset class, metrics below a coverage threshold are excluded and remaining weights are reweighted proportionally; surface exclusions in breakdown.
- Z-shrink for thin samples: when peer count for a metric is small, shrink Z by a factor λ(count) to reduce volatility; surface the shrink factor.

### Sprint B (P1)
- Adaptive winsorization: derive per-class quantile clamps for each metric (fallback to static clamps for small n).
- Effective weights inspector: show profile, and effective weights by source (fund/class/global/default).

### Sprint C (P2)
- Robust scaling to 0–100 using per-class robust anchors (e.g., 5th/median/95th percentiles), behind a feature flag.
- Optional benchmark-delta derived metric with small positive weight, gated by data presence.

### Sprint D (P1)
- Refactor scoring into math/policy/metrics modules with focused unit tests.

## Feature Flags / Config (to add)
- REACT_APP_SCORING_COVERAGE_THRESHOLD (default 0.4)
- REACT_APP_SCORING_Z_SHRINK_K (default 10)
- REACT_APP_ENABLE_ADAPTIVE_WINSOR (default false)
- REACT_APP_WINSOR_Q_LO / REACT_APP_WINSOR_Q_HI (defaults 0.01 / 0.99)
- REACT_APP_ENABLE_ROBUST_SCALING (default false)
- REACT_APP_ENABLE_BENCH_DELTA (default false)

## Progress Log

- [Sprint A] Initialize notes and flags. Implement coverage-aware weighting (per-class) and Z-shrink for thin samples. Add breakdown fields `excludedForCoverage` and `zShrinkFactor`. Update unit tests.
- [Sprint B] Implement adaptive winsorization (empirical per-class clamps) and weights inspector data (weight source per metric). Add tests.
- [Sprint C] Implement robust scaling flag and optional benchmark delta metric. Add tests.
- [Sprint C] Added robust scaling unit test and benchmark-delta unit test; integrated delta metric into defaults with 0 weight.
- [Sprint D] Refactor scoring code and add pure-unit tests.

# Lightship Balanced Redesign — Project Notes

## Vision
- Wealth-management focused platform: curated recommended funds/ETFs, categorized by asset class, tracked versus benchmarks.
- Proprietary scoring is the differentiator; data clarity and trust-first UX are mandatory.

## Principles
- Supabase as single source of truth for live views
- Clear As-of month everywhere; enforce end-of-month for snapshots
- Ingestion that “just works”: parse → seed missing funds → import → verify
- Data Health before analysis: surface what’s missing and how to fix it

## Roadmap
- Phase 1 (Balanced): Fix ingestion/visibility, unify reads, Data Health, As-of clarity
- Phase 2 (Scoring): Improve weights, missing-data handling, outlier policy, benchmark-relative features
- Phase 3 (Ops): Server-side scoring, approvals/audit trail, scheduled refresh

## Kanban
- Backlog
  - Server-side scoring job (persisted per-month scores)
  - Migrate legacy historical snapshots into Supabase tables
  - Setup screen for missing Supabase env vars
- In Progress
  - Normalize field usage in Funds/Drilldown; consistent benchmark deltas
  - Data Health: wire CTAs to Admin; EOM banner to Utilities
  - Standardize empty/error states and add inline “Why this fund” badges in Funds
- Done
  - Project notes created; plan agreed
  - RPC `get_funds_as_of(date)` added; Supabase stub supports rpc
  - Importer: enabled in non‑prod; Seed missing funds button + re-parse
  - App shell: simplified nav; global As-of selector; Overview trust meter
  - Data Health upgraded: counts, coverage bars, dictionary readiness, Admin quick actions
  - Admin Utilities: Convert Snapshot to EOM tool; non-EOM banner wired
  - Setup guard for missing Supabase env vars
  - Funds: header tooltips, normalized getters, Export Recommended button, empty-state CTA to Importer
  - Drilldown: top reasons chips and metric tooltips; benchmark missing prompt

## Phase 1 — Objectives and Acceptance Criteria
- Objectives
  - Reliable ingestion and visibility (Supabase-first)
  - Single read path (no N+1)
  - Clear As-of month across views
  - Actionable Data Health panel
- Acceptance
  - After CSV import + seeding, the imported month appears in Performance and is populated
  - As-of selector affects all relevant views consistently
  - Data Health shows >80% non-null for YTD/1Y/Sharpe/StdDev3Y on the active month
  - A single RPC powers fund+performance reads as-of (no per-fund queries)
  - Importer exposes “Skipped by reason” and “Seed missing funds” action

## Phase 1 — Task Breakdown
- Data read path
  - [ ] Create RPC/view: funds joined with latest performance ≤ as-of date
  - [ ] Update `useFundData` to use RPC; remove N+1 fetches
- Importer
  - [ ] Enable importer in non-prod; show in Admin
  - [ ] Add “Seed missing funds” action; re-run import; enforce EOM
  - [ ] Auto-set As-of to imported EOM; show confirmation
- Data Health
  - [ ] Month counts (funds vs benchmarks), % non-null by metric, class-level coverage
  - [ ] Warnings + links to Importer/As-of selector
- As-of UX
  - [ ] Unify selector; persist; sync across tabs
- Field harmonization
  - [ ] Normalize components to live keys; keep legacy fallbacks as needed
- Guardrails
  - [ ] Setup screen if Supabase env missing

## Work Log
- 2025-08-13: Kickoff; agreed Phase 1 scope; created plan; started RPC + importer improvements
- 2025-08-13: Added RPC and stub support; importer seeding; simplified nav; global As-of; trust meter; Data Health MVP; EOM convert tool and banner
- 2025-08-13: Setup guard; Funds table normalization + tooltips + Export Recommended; Drilldown rationale/tooltips; Data Health/Admin deep links
 - 2025-08-13: Standardized empty states (Funds/Drilldown) with concise guidance; added inline “Why this fund” badges in Funds (top positive score contributors with tooltips)
 - 2025-08-14: Phase 2 started — winsorization and tiny-class fallback scaffolds (flags OFF); negative contributor badge for low-score funds; Comparison tooltips aligned; Data Health guidance/thresholds tightened; tests added.
 - 2025-08-13: Sprint 1 started — added Router, URL-synced tabs, header toolbar (As-of, Refresh, Export, Help); fixed conditional hook in DrilldownCards; CI build verified

## Decisions
- Supabase is the live source; legacy history remains read-only for now
- Runtime scoring remains client-side in Phase 1; accuracy warnings via Data Health

## Risks & Mitigations
- Non-EOM imports → enforce EOM and convert where needed
- Benchmarks present without funds → Data Health flags + importer CTA
- Env misconfiguration → Setup guard page when Supabase env missing

## Scoring (Phase 2 exploration)
- Improve robustness: winsorization, minimum peer count per class, coverage-weighted scoring
- Benchmark-relative features and class-level weight overrides
