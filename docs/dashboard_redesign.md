## Dashboard Redesign (Home)

Purpose: Replace the legacy Overview with a focused Home dashboard that answers: What’s the state now? What changed? What needs attention? What should I do next?

Structure
- Top bar: As-of selector context in header, quick actions (Import, Data Health, Compare, Export)
- KPI row: Funds, Recommended, Min Coverage, Alerts, Snapshot date/freshness
- Triage feed: Actionable issues (missing data, non‑EOM, coverage, unresolved funds, classes missing primary benchmarks)
- What Changed: Top/bottom score movers vs prior EOM, newly recommended/dropped, breadth stats
- Widgets: Mini Heatmap, Top/Bottom performers, Asset Class mini, optional Recent Notes (flagged)

Feature flags
- REACT_APP_ENABLE_NOTES=true shows Recent Notes widget
- REACT_APP_ENABLE_SAVED_VIEWS governs widget visibility persistence

Usage
1) Import a monthly snapshot via Admin → Data Uploads
2) Home updates automatically (asOf subscription)
3) Use quick actions to open Importer, Data Health, Compare, or Export

Accessibility & responsiveness
- Sections labeled via ARIA; widget toggles are keyboard-friendly
- Responsive grid with skeletons while loading

Screenshots
- See `docs/screenshots/compare_view.svg`, `docs/screenshots/performance_table.svg`, `docs/screenshots/drilldown_cards.svg`

QA
- See `docs/QA_CHECKLIST.md` for Sprint 4 verification steps

E2E smoke (Sprint 4)
- Import → Home KPIs update; Triage shows issues if any
- Deltas reflect next EOM snapshot; deep links navigate (Importer, Data Health)
- Widget toggles persist across reload; Recent Notes appears when flag ON

# Dashboard Redesign (Home)

Goal: Replace the legacy overview with a focused Home dashboard that answers: What is the state now? What changed? What needs attention? What should I do next?

Core sections
- Top bar: As-of selector, last import info, freshness
- KPI strip: Funds, Recommended, Min coverage %, Alerts, Snapshot date
- Triage feed: Missing benchmarks/classes, Unresolved funds, Low coverage, Non‑EOM/Zero rows
- What Changed: movers (up/down), newly recommended/dropped vs prior EOM
- Widgets: Mini Heatmap, Top/Bottom, Asset Class mini
- Quick actions: Import, Compare, Export, Data Health

Notes
- Use `dashboardService` to gather KPIs, triage, and deltas
- Respect `REACT_APP_ENABLE_NOTES` for Notes widget

Acceptance criteria
- Home reflects active as-of month and updates after imports without refresh
- Triage actions route correctly to Admin sections
- Deltas calculated vs prior EOM snapshot

