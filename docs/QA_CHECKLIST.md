## Sprint 4 QA Checklist

Smoke flow
- Import a monthly CSV (Admin → Monthly Snapshot Upload) and confirm:
  - Home KPIs update; snapshot date and freshness reflect active month
  - Triage shows issues when applicable; deep links navigate correctly
  - What Changed populates after a second EOM snapshot exists

Widgets
- Heatmap, Top/Bottom, and Asset Class sections render; loading skeletons visible while fetching
- Toggle visibility for each widget; reload page and confirm persistence
- Recent Notes shows only when `REACT_APP_ENABLE_NOTES=true` (empty state when none)

Accessibility
- Section headings announced; toggles are focusable and operable by keyboard
- Select inputs have labels or aria-labels

Routing
- Sidebar: Home, Funds, Asset Classes, Data Health, Admin
- Programmatic deep links (Importer, Health, Catalogs/Benchmarks) navigate

Exports
- Home Export (Excel) works; first sheet named "Summary"
- Admin and table exports still work

Regression checks
- No console errors on navigation or after importing
- All tests pass via `npm run test:ci`

