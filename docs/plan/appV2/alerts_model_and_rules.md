# Phase 4: Alerts Model, Rules, and Command Center

## Data Model (SQL)
- alert_rules: configurable rules with `rule_type`, `params` JSON, `severity_default`, `scope`, `is_active`.
- alerts: generated instances with `month`, `ticker`, `asset_class`, `severity`, `priority`, `status`, `signal_value`, `net_flow`, `advisors_trading`, and details JSON.
- alert_actions: audit-able actions (acknowledge/resolve/suppress/reopen/assign/comment) with actor and note.

Indexes and GRANTs are included; RLS remains disabled per current project posture. See `supabase/migrations/20250903_alerts_and_trend_analytics.sql`.

## Rule Types and Params
- NET_FLOW_SIGMA: unusual inflow/outflow by z-score vs trailing window
  - params: { window_months: int (default 12), sigma_threshold: number (default 2.0) }
- ADVISOR_SPIKE_RATIO: advisors_trading ratio vs trailing average
  - params: { window_months: int (default 6), min_ratio: number (default 1.5), min_advisors: int (default 5) }
- REDEMPTION_STREAK: consecutive outflows including current month
  - params: { streak_months: int (default 3), min_total_outflow: number (default 1_000_000) }

Sample defaults are inserted by the migration.

## RPCs
- refresh_alerts_for_month(p_month): computes alerts for active rules; returns row count inserted.
- get_alerts(p_status, p_severity, p_asset_class, p_min_priority, p_limit, p_after_id): lists alerts with filters and pagination.
- acknowledge_alert(p_alert_id, p_actor, p_note): sets status to acknowledged and logs action.
- resolve_alert(p_alert_id, p_actor, p_note): sets status to resolved and logs action.
- get_trend_analytics(p_month, p_ticker, p_windows[]): rolling net flow sums and advisors_trading stddev per window.

## Command Center (MVP)
- Filters: status, severity, asset class, min priority.
- Prioritized list: shows priority, severity, month, ticker, asset class, title, net flow, advisors.
- Detail panel: key fields, optional note, actions: Acknowledge / Resolve (audited).
- Bulk actions: multi-select acknowledge/resolve.

UI scaffold at `src/components/CommandCenter/CommandCenter.jsx` and client at `src/services/alertsService.js`.

## SLAs & Performance
- refresh_alerts_for_month: target < 1500ms for 2–5K tickers; runs monthly or on import.
- get_alerts: p95 < 500ms with typical filters; indexed by (status, priority, created_at).
- get_trend_analytics: p95 < 800ms per ticker (3/6/12 windows).

Benchmark locally
- Flows RPCs: `node scripts/benchFlows.mjs --month=YYYY-MM-01 --runs=10`
- Alerts RPCs: `node scripts/benchAlerts.mjs --month=YYYY-MM-01 --runs=10 --ticker=SPY`

Vercel p95 capture
- Serverless endpoint: `api/metrics.js` writes to `public.rpc_timings`
- Migration: `supabase/migrations/20250903_metrics_timings.sql`
- Client instrumentation (feature-flagged): set `REACT_APP_METRICS_ENABLED=1` to emit timings for
  - `alerts.refresh` (refresh_alerts_for_month)
  - `alerts.list` (get_alerts)
  - `analytics.trend` (get_trend_analytics)
- Query p95 in Supabase:
  - `select * from get_rpc_p95('alerts.list', '7 days');`
  - `select * from get_rpc_p95('analytics.trend', '7 days');`
  - `select * from get_rpc_p95('alerts.refresh', '7 days');`

Cron scheduling
- vercel.json includes a cron:
  - path: `/api/alerts/refresh`
  - schedule: `0 9 1 * *` (monthly, 09:00 UTC)
- Auth options for `/api/alerts/refresh`:
  - Header: `X-Refresh-Token: $APP_ALERTS_CRON_TOKEN` or query `?token=$APP_ALERTS_CRON_TOKEN`
  - Or set `APP_ALERTS_CRON_PUBLIC=1` (no token required; for internal envs only)

## Validation Steps
1) Seed or import trades; refresh MVs: `refresh_fund_flows_mv()`.
2) Generate alerts: `select refresh_alerts_for_month(null);` (uses latest month).
3) Verify counts by rule: `select rule_type, count(*) from alerts a join alert_rules r on r.id = a.rule_id group by 1;`.
4) Spot-check examples:
   - NET_FLOW_SIGMA: compare current net vs 12M mean/stddev, recompute z.
   - ADVISOR_SPIKE_RATIO: check advisors_trading vs 6M avg and min_advisors.
   - REDEMPTION_STREAK: confirm consecutive negatives and total outflow.
5) p95 timings: instrument Vercel serverless endpoints calling RPCs; log durations to analytics with labels `alerts.refresh`, `alerts.list`, `analytics.trend`.

## Usage Runbook
- Generate alerts for latest month (admin/cron): `select refresh_alerts_for_month(null);`
- Vercel cron (optional): `POST /api/alerts/refresh` with header `X-Refresh-Token: $APP_ALERTS_CRON_TOKEN` or use `?token=...`
- Env: set `APP_ALERTS_CRON_TOKEN` (server), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (or `APP_ALERTS_CRON_PUBLIC=1` for public allow)
- Command Center:
  - Open Command Center tab; filter to `status=open`, `minPriority>=50`.
  - Review highest priority first; add notes; Acknowledge when triaged; Resolve when action is completed.
  - Bulk actions for housekeeping after monthly review.
  - Drill-through: Use “Open in Flows” to jump to Flows view prefiltered to the alert’s month/ticker.
- Export/Reporting: integrate selected alerts into PDF/CSV (planned).

Rules administration (MVP)
- Location: Command Center page, Rules Admin card
- Actions: toggle `is_active`, change `severity_default`, edit `params` JSON per rule
- Validation: after edits, rerun `refresh_alerts_for_month` and verify alert volumes


