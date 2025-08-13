# UX Spec (Phase 1)

- Information Architecture
  - Overview: KPI cards, global As-of selector (EOM), trust meter; quick links to issues
  - Funds: RPC-backed table; normalized live fields; benchmark deltas; drilldown
  - Asset Classes: summaries; link to constituents
  - Data Health: counts, coverage, dictionary readiness; CTAs to Admin
  - Admin: Importer with seeding; Benchmarks dictionary; Utilities (Convert to EOM)

- Components
  - Global header: As-of selector, Help
  - Trust Meter: min coverage across YTD, 1Y, Sharpe, StdDev(3Y)
  - Data Health panel: coverage bars and quick actions
  - Funds table: live-field getters; benchmark delta chip; export; inline “Why this fund” badges showing top positive contributors from scoring breakdown
  - Drilldown: score, top reasons from breakdown, deltas for 1Y/3Y/Risk metrics

- States
  - Missing env: Setup guard with instructions
  - Non-EOM active month: warning banner linking to Convert-to-EOM
  - Empty/Loading/Error: concise messages + actions; Funds empty state suggests adjusting filters and links to Importer; Drilldown shows “No fund selected” with brief guidance

- Navigation
  - Programmatic events for deep linking:
    - NAVIGATE_APP { tab }
    - NAVIGATE_ADMIN { subtab }

- Notes
  - Prefer Supabase live keys across UI; retain legacy fallbacks only if harmless
  - Benchmark deltas require same-day rows for fund and benchmark