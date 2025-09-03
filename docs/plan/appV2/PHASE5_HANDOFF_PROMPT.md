# Phase 5 Handoff Prompt – Lightship Fund Analysis App

You are joining Phase 5 (finalization) of the Lightship Fund Analysis App. Phases 1–4 are complete. Use `docs/plan/appV2/lightship-enhancement-plan.md` as the living tracker. Keep it updated with every substantive change (db, rpc, ui, scripts, timings).

What’s in place (through Phase 4):
- Data: `client_holdings`, `trade_activity`; MVs: `advisor_metrics_mv`, `fund_flows_mv`
- Phase 3 RPCs: `get_top_movers`, `get_advisor_participation`, `get_flow_by_asset_class`, `get_advisor_breakdown`
- Dashboards: Trade Flows (Net Flow Trend, Advisor Sentiment, Top Movers, Heatmap) with compare vs prior-month
- Exports: CSV/PDF for flows; professional React-PDF monthly report framework
- Alerts (Phase 4):
  - SQL: `alert_rules`, `alerts`, `alert_actions` (+ UNIQUE on (name, rule_type))
  - RPCs: `refresh_alerts_for_month(p_month)`, `get_alerts(...)`, `acknowledge_alert(...)`, `resolve_alert(...)`
  - Trend analytics: `get_trend_analytics(p_ticker, p_month, p_windows[])`
  - Command Center: prioritized queues, filters, detail with audit log, trend analytics, bulk actions, drill-through to Flows
  - Rules Admin (MVP): toggle active, edit severity & params; create/delete rules
  - p95 capture path: `api/metrics.js` → `public.rpc_timings`, `get_rpc_p95` function
  - Cron endpoint: `api/alerts/refresh` (header or query token; optional public allow)
  - Benchmarks: `scripts/benchAlerts.mjs`, `scripts/benchFlows.mjs`

Environment:
- Supabase URL + keys set; service role available to serverless (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`)
- Client: `REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_ANON_KEY` configured
- Optional metrics: `REACT_APP_METRICS_ENABLED=1`
- Cron auth (optional): `APP_ALERTS_CRON_TOKEN` (or `APP_ALERTS_CRON_PUBLIC=1` in internal envs)
- vercel.json includes a monthly cron: `0 9 1 * *` → `/api/alerts/refresh`

Immediate Phase 5 goals (final polish + production readiness):
1) Rules Admin hardening
   - Add per-rule-type param schemas and UI validation (e.g., NET_FLOW_SIGMA: window_months int>=3, sigma_threshold in [1..5])
   - RBAC: ensure only admin can manage rules (align with project posture; current RLS disabled, rely on app auth)
   - UX: inline error messages; confirmation to toggle is_active on high-impact rules
2) Exports & reporting
   - Alerts CSV export from Command Center (filtered set)
   - Optional React-PDF “Alerts Report” and/or section in Monthly report (top alerts, by severity, per asset class)
   - Ensure export numeric formatting and consistent column labels
3) Automation & SLOs
   - Finalize cron strategy: refresh MVs + alerts on EOM; optionally daily pre-check
   - Add Admin panel surface for `get_rpc_p95` (alerts.list, analytics.trend, alerts.refresh)
   - Document SLA thresholds and runbook steps in the plan
4) Command Center polish & scale
   - Virtualize long lists; add filter chips and quick presets (e.g., critical-only)
   - Cursor pagination via `p_after_id`; keyboard navigation & accessibility checks
   - Assignment flow: enable `assign` action (extend UI; table supports it already)
5) Performance & DB checks
   - Verify indexes: consider `(asset_class, status, priority desc)` if needed; analyze query plans
   - Cap alert insert volume per run (guardrails) and dedupe logic confirm

Deliverables:
- UI: Rules Admin (schemas, create/delete, RBAC), Command Center exports & polish
- Server: Optional monthly alerts PDF, admin p95 panel or API endpoint, refined cron flow (refresh MVs then alerts)
- SQL: Param constraints (where feasible), indexes if required, any small helper RPCs
- Docs: Update `lightship-enhancement-plan.md` with rules, SLOs, p95 snapshots, cron schedules, export specs, and a short runbook

References:
- Plan (living): `docs/plan/appV2/lightship-enhancement-plan.md`
- Alerts schema/RPCs: `supabase/migrations/20250903_alerts_and_trend_analytics.sql`
- Unique index: `supabase/migrations/20250903_alert_rules_unique.sql`
- Metrics: `supabase/migrations/20250903_metrics_timings.sql`, `api/metrics.js`
- Cron refresh: `api/alerts/refresh.js`, `vercel.json`
- UI: `src/components/CommandCenter/CommandCenter.jsx`, `src/components/CommandCenter/RulesAdmin.jsx`
- Services: `src/services/alertsService.js`
- Benchmarks: `scripts/benchAlerts.mjs`, `scripts/benchFlows.mjs`

Start by confirming rules admin needs (schemas, RBAC), then implement exports and the admin p95 panel. Keep `lightship-enhancement-plan.md` updated with each change (what/why/perf impact).

