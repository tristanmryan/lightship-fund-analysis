# Dashboard Redesign Project - Sprints

This file tracks the new Home dashboard project (replacing legacy overview). Previous sprint notes have been archived under `docs/projects/`.

## Sprint 1 – Foundation & Skeleton (current)
- Create `src/components/Dashboard/Home.jsx` with modular grid layout (Top bar → KPIs → Triage → What Changed → Widgets row → Quick actions)
- Add `src/services/dashboardService.js` with stubbed contracts:
  - `getKpis(asOf)` → { funds, recommended, minCoverage, alertsCount, snapshotDate, freshnessDays }
  - `getTriage(asOf)` → array of items { severity, title, detail, action }
  - `getDeltas(currAsOf, prevAsOf)` → { moversUp[], moversDown[], newlyRecommended[], dropped[] }
- Wire Home into navigation (replace any “Overview” entry with Home)
- Render placeholders fed by service
- Tests: smoke render + shape checks

## Sprint 2 – Triage & What Changed
- Implement triage using existing data and `HealthCheck` logic: unresolved funds, classes missing benchmarks, low metric coverage, non‑EOM/zero rows
- Implement deltas vs prior EOM snapshot (compare two dates via queries)
- Action buttons: Importer, Catalogs, Data Health deep-links
- Persist minimal widget visibility via `preferencesService`

## Sprint 3 – Widgets & Polish
- Add widgets: Mini Heatmap, Top/Bottom performers, Asset Class mini-overview (condensed)
- Add quick actions: Import CSV, Compare, Export report, Open Data Health
- Optional: Notes feed if `REACT_APP_ENABLE_NOTES` is true
- Responsive layout, skeletons, and empty states

## Sprint 4 – Docs & QA
- Create `docs/dashboard_redesign.md` with screenshots and usage
- E2E smoke: Import → Home updates without manual refresh; Triage links navigate to Admin; deltas reflect next snapshot
- Retire legacy “overview” references

Acceptance criteria
- Home shows KPIs, triage, deltas for active as-of month
- After import, Home updates automatically (store subscription)
- Action buttons route correctly

