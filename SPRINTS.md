# UX Improvement Sprints

## Sprint 1 – Routing + Toolbar + Shortcuts
- [x] Add `react-router-dom@6` and wrap in `BrowserRouter` (`src/index.js`)
- [x] URL-synced tabs and sidebar navigation (`src/App.jsx`)
- [x] Number key shortcuts update to route-aware navigation
- [x] Header toolbar: As-of Month, Refresh, Export, Help
- [x] Export uses `exportService` and matches Ctrl+E
- [x] Fix conditional hook in `DrilldownCards.jsx`
- [x] Build passes with CI-safe script
- [x] Persist last visited tab in `localStorage`
- [x] Legacy route aliases (`/funds`, `/scores` → `/performance`)
- [x] Keyboard shortcut hint in sidebar

## Sprint 2 – Import Wizard + Empty/Loading/Error States (completed)
- [x] “Use sample data” toggle for importer (loads `public/sample-data/monthly_example.csv`)
- [x] Skeleton loaders framework in Performance dashboard
- [x] CSV import: drag-and-drop support and manual header mapping
- [x] Validate/confirm modal with summary prior to import
- [x] Rich empty states with actions across Dashboard/Analytics
  - [x] Dashboard empty state CTA to Importer + one-click sample load
  - [x] Analytics empty/skeleton states

## Sprint 3 – Data Health Triage + Methodology (completed)
- [x] Triage board (Critical/Warning/Info) with quick fixes in `HealthCheck`
- [x] Health badge in sidebar (min coverage)
- [x] Methodology drawer + global trigger in header
- [x] Info buttons on key table metrics trigger Methodology
- [x] Info buttons added to Analytics cards (Heatmap/Overview/Performers/Compare)
- [x] Health triage quick actions deep-link to Admin sections

## Sprint 4 – Analytics polish + Sharing (planned)
 - [x] Consistent chart tooltips and cross-highlighting
  - [x] Unified tooltip styles for Heatmap (shared styles)
  - [x] Heatmap hover emits highlight; Performers and Heatmap cross-highlight
- [x] Export cards as PNG (Heatmap/Overview/Performers/Compare)
- [x] Copy charts to clipboard when supported
 - [x] Shareable URLs including filters (copy share link)
  - [x] Cross-highlighting between Performers and Heatmap (hover)
  - [x] Include Compare selection in shared link (best-effort)

