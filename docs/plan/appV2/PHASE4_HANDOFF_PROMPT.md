# Phase 4 Handoff Prompt

Paste this prompt into a new chat to kick off Phase 4.

---

You are joining Phase 4 of the Lightship Fund Analysis App. Phases 1–3 are complete. Use docs/plan/appV2/lightship-enhancement-plan.md for context.

What’s in place (Phase 3):
- RPCs: get_top_movers, get_advisor_participation, get_flow_by_asset_class, get_advisor_breakdown
- UI: Trade Flow Dashboard with Net Flow Trend (3/6/12/24M), Advisor Sentiment, Top Movers, Flow Heatmap
- Compare mode: prior-month deltas shown in UI and included in CSV/PDF exports
- Scripts: scripts/validateFlows.mjs (penny-accuracy), scripts/benchFlows.mjs (RPC timings)
- Validation: top 20 tickers matched penny-accurate vs get_fund_flows (see plan)

Environment ready:
- SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (server) and client REACT_APP_* are configured; Phase 3 RPC migration applied

Immediate Phase 4 goals:
1) Design and implement an Alerts pipeline (rules, storage, UI): unusual flows, advisor activity spikes, redemption patterns
2) Build a Command Center view with prioritized queues, filters, drill-through, and audit-able actions
3) Add trend analytics RPC(s): rolling multi-month net flows and advisor participation volatility per ticker
4) Capture p95 timings in Vercel for new RPCs and update the plan

Deliverables:
- SQL migrations (alerts tables + RPCs) with GRANTs
- UI: Command Center (list + detail), alert filters, bulk actions, audit log display
- Docs: update plan with rules, SLAs, and validation steps; include usage runbook

References:
- docs/plan/appV2/lightship-enhancement-plan.md (Phase 4 Kickoff Notes)
- supabase/migrations/20250902_trade_flow_rpcs.sql (Phase 3 RPCs)
- src/components/Analytics/TradeFlowDashboard.jsx (compare deltas example)
- scripts/validateFlows.mjs, scripts/benchFlows.mjs

Start by proposing the alerts data model (SQL), sample rules, and the minimum viable Command Center UI structure. Then implement the migrations and a basic UI scaffold.
