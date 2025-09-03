-- Phase 4: Alerts pipeline (tables + RPCs) and Trend Analytics RPC

-- 1) Alerts Data Model

-- Rules table: configurable alert rules with typed parameters
CREATE TABLE IF NOT EXISTS public.alert_rules (
  id               bigserial PRIMARY KEY,
  name             text        NOT NULL,
  description      text        NULL,
  rule_type        text        NOT NULL CHECK (rule_type IN (
                    'NET_FLOW_SIGMA',           -- unusual inflow/outflow by z-score vs trailing window
                    'ADVISOR_SPIKE_RATIO',      -- advisors_trading ratio vs trailing avg
                    'REDEMPTION_STREAK'        -- N consecutive outflow months
                  )),
  scope            text        NOT NULL DEFAULT 'ticker' CHECK (scope IN ('ticker','asset_class','global')),
  severity_default text        NOT NULL DEFAULT 'warning' CHECK (severity_default IN ('info','warning','critical')),
  params           jsonb       NOT NULL DEFAULT '{}'::jsonb, -- typed per rule_type (see samples below)
  is_active        boolean     NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  created_by       text        NULL
);

ALTER TABLE public.alert_rules DISABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.alert_rules TO anon, authenticated, service_role;

-- Alerts table: generated instances with status transitions
CREATE TABLE IF NOT EXISTS public.alerts (
  id                 bigserial PRIMARY KEY,
  rule_id            bigint      NOT NULL REFERENCES public.alert_rules(id) ON DELETE CASCADE,
  month              date        NOT NULL, -- as-of month for the signal
  ticker             text        NULL,
  asset_class        text        NULL,
  severity           text        NOT NULL CHECK (severity IN ('info','warning','critical')),
  priority           int         NOT NULL DEFAULT 50, -- 0-100 relative ordering in queues
  status             text        NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved','suppressed')),
  title              text        NOT NULL,
  summary            text        NULL,
  details            jsonb       NULL, -- signal-specific payload
  signal_value       numeric     NULL, -- e.g., z-score, ratio, streak length
  net_flow           numeric     NULL, -- convenience for UI
  advisors_trading   int         NULL, -- convenience for UI
  created_at         timestamptz NOT NULL DEFAULT now(),
  acknowledged_at    timestamptz NULL,
  resolved_at        timestamptz NULL,
  acknowledged_by    text        NULL,
  resolved_by        text        NULL
);

CREATE INDEX IF NOT EXISTS idx_alerts_status_priority ON public.alerts (status, priority DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_month_ticker ON public.alerts (month, ticker);
ALTER TABLE public.alerts DISABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.alerts TO anon, authenticated, service_role;

-- Alert actions: audit-able state transitions and notes
CREATE TABLE IF NOT EXISTS public.alert_actions (
  id          bigserial PRIMARY KEY,
  alert_id    bigint      NOT NULL REFERENCES public.alerts(id) ON DELETE CASCADE,
  action      text        NOT NULL CHECK (action IN ('acknowledge','resolve','suppress','reopen','assign','comment')),
  actor       text        NULL,
  note        text        NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alert_actions_alert ON public.alert_actions (alert_id, created_at DESC);
ALTER TABLE public.alert_actions DISABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.alert_actions TO anon, authenticated, service_role;

-- 2) Helper: resolve latest month
CREATE OR REPLACE FUNCTION public._latest_fund_flow_month()
RETURNS date
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE((SELECT MAX(month) FROM public.fund_flows_mv), DATE_TRUNC('month', CURRENT_DATE)::date);
$$;

GRANT EXECUTE ON FUNCTION public._latest_fund_flow_month() TO anon, authenticated, service_role;

-- 3) Trend analytics RPC: rolling net flow and advisor participation volatility per ticker
-- Returns one row per window (e.g., 3/6/12 months)
CREATE OR REPLACE FUNCTION public.get_trend_analytics(
  p_ticker  text,
  p_month   date DEFAULT NULL,
  p_windows int[] DEFAULT ARRAY[3,6,12]
)
RETURNS TABLE (
  window_months int,
  net_flow_sum numeric,
  advisors_trading_stddev numeric
)
LANGUAGE sql
STABLE
AS $$
  WITH pick AS (
    SELECT COALESCE(p_month, public._latest_fund_flow_month()) AS m
  ), series AS (
    SELECT UNNEST(p_windows) AS w
  ), base AS (
    SELECT f.month, f.ticker, (f.inflows - f.outflows) AS net_flow, f.advisors_trading
    FROM public.fund_flows_mv f
    JOIN pick ON f.month <= pick.m
    WHERE f.ticker = p_ticker
  ), roll AS (
    SELECT s.w AS window_months,
           SUM(b.net_flow) FILTER (WHERE b.month > (SELECT (pick.m + INTERVAL '1 month')::date - (s.w || ' months')::interval FROM pick)) AS net_flow_sum,
           STDDEV_SAMP(b.advisors_trading::numeric) FILTER (WHERE b.month > (SELECT (pick.m + INTERVAL '1 month')::date - (s.w || ' months')::interval FROM pick)) AS advisors_trading_stddev
    FROM series s
    CROSS JOIN base b
    GROUP BY s.w
  )
  SELECT window_months,
         COALESCE(net_flow_sum, 0) AS net_flow_sum,
         COALESCE(advisors_trading_stddev, 0) AS advisors_trading_stddev
  FROM roll
  ORDER BY window_months;
$$;

GRANT EXECUTE ON FUNCTION public.get_trend_analytics(text, date, int[]) TO anon, authenticated, service_role;

-- 4) Alert generation RPC: compute alerts for a month from active rules
CREATE OR REPLACE FUNCTION public.refresh_alerts_for_month(
  p_month date DEFAULT NULL
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_month date;
  v_inserted int := 0;
  v_rows int := 0;
BEGIN
  SELECT COALESCE(p_month, public._latest_fund_flow_month()) INTO v_month;

  -- NET_FLOW_SIGMA: z-score of net flow vs trailing window
  INSERT INTO public.alerts (rule_id, month, ticker, asset_class, severity, priority, status, title, summary, details, signal_value, net_flow, advisors_trading)
  SELECT r.id AS rule_id,
         v_month AS month,
         cur.ticker,
         COALESCE(f.asset_class, 'Unclassified') AS asset_class,
         COALESCE(r.severity_default, 'warning') AS severity,
         LEAST(100, GREATEST(10, 50 + (ABS(z) * 10)::int)) AS priority,
         'open' AS status,
         CONCAT('Unusual ', CASE WHEN cur.net_flow >= 0 THEN 'Inflow' ELSE 'Outflow' END, ' for ', cur.ticker) AS title,
         CONCAT('Z-score ', ROUND(z::numeric, 2), ' vs ', win, 'M window; Net ', cur.net_flow) AS summary,
         jsonb_build_object(
           'type','NET_FLOW_SIGMA',
           'window_months', win,
           'z', z,
           'mean', mean,
           'stddev', stddev
         ) AS details,
         z AS signal_value,
         cur.net_flow AS net_flow,
         cur.advisors_trading AS advisors_trading
  FROM public.alert_rules r
  CROSS JOIN LATERAL (
    SELECT COALESCE((r.params->>'window_months')::int, 12) AS win,
           COALESCE((r.params->>'sigma_threshold')::numeric, 2.0) AS sigma
  ) cfg
  JOIN LATERAL (
    SELECT ff.ticker,
           (ff.inflows - ff.outflows) AS net_flow,
           ff.advisors_trading
    FROM public.fund_flows_mv ff
    WHERE ff.month = v_month
  ) cur ON TRUE
  LEFT JOIN public.funds f ON f.ticker = cur.ticker
  JOIN LATERAL (
    SELECT AVG((prev.inflows - prev.outflows)) AS mean,
           NULLIF(STDDEV_SAMP((prev.inflows - prev.outflows)), 0) AS stddev
    FROM public.fund_flows_mv prev
    WHERE prev.ticker = cur.ticker
      AND prev.month >= (v_month + INTERVAL '1 month')::date - (cfg.win || ' months')::interval
      AND prev.month < v_month
  ) stats ON TRUE
  CROSS JOIN LATERAL (
    SELECT CASE WHEN stats.stddev IS NULL THEN NULL ELSE (cur.net_flow - stats.mean) / stats.stddev END AS z
  ) zcalc
  WHERE r.is_active = true
    AND r.rule_type = 'NET_FLOW_SIGMA'
    AND zcalc.z IS NOT NULL
    AND ABS(zcalc.z) >= cfg.sigma
    AND NOT EXISTS (
      SELECT 1 FROM public.alerts a
      WHERE a.rule_id = r.id AND a.month = v_month AND a.ticker = cur.ticker AND a.status IN ('open','acknowledged')
    );
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_inserted := v_inserted + v_rows;

  -- ADVISOR_SPIKE_RATIO: advisors_trading vs trailing avg
  INSERT INTO public.alerts (rule_id, month, ticker, asset_class, severity, priority, status, title, summary, details, signal_value, net_flow, advisors_trading)
  SELECT r.id AS rule_id,
         v_month AS month,
         cur.ticker,
         COALESCE(f.asset_class, 'Unclassified') AS asset_class,
         COALESCE(r.severity_default, 'info') AS severity,
         LEAST(100, GREATEST(10, 40 + (ratio * 10)::int)) AS priority,
         'open' AS status,
         CONCAT('Advisor Activity Spike for ', cur.ticker) AS title,
         CONCAT('Participation ratio ', ROUND(ratio::numeric, 2), ' vs ', win, 'M avg; Advisors ', cur.advisors_trading) AS summary,
         jsonb_build_object(
           'type','ADVISOR_SPIKE_RATIO',
           'window_months', win,
           'ratio', ratio,
           'avg', trailing_avg
         ) AS details,
         ratio AS signal_value,
         cur.net_flow AS net_flow,
         cur.advisors_trading AS advisors_trading
  FROM public.alert_rules r
  CROSS JOIN LATERAL (
    SELECT COALESCE((r.params->>'window_months')::int, 6) AS win,
           COALESCE((r.params->>'min_ratio')::numeric, 1.5) AS min_ratio,
           COALESCE((r.params->>'min_advisors')::int, 5) AS min_advisors
  ) cfg
  JOIN LATERAL (
    SELECT ff.ticker,
           (ff.inflows - ff.outflows) AS net_flow,
           ff.advisors_trading
    FROM public.fund_flows_mv ff
    WHERE ff.month = v_month
  ) cur ON TRUE
  LEFT JOIN public.funds f ON f.ticker = cur.ticker
  JOIN LATERAL (
    SELECT NULLIF(AVG(prev.advisors_trading::numeric), 0) AS trailing_avg
    FROM public.fund_flows_mv prev
    WHERE prev.ticker = cur.ticker
      AND prev.month >= (v_month + INTERVAL '1 month')::date - (cfg.win || ' months')::interval
      AND prev.month < v_month
  ) stats ON TRUE
  CROSS JOIN LATERAL (
    SELECT CASE WHEN stats.trailing_avg IS NULL THEN NULL ELSE cur.advisors_trading::numeric / stats.trailing_avg END AS ratio
  ) rc
  WHERE r.is_active = true
    AND r.rule_type = 'ADVISOR_SPIKE_RATIO'
    AND rc.ratio IS NOT NULL
    AND cur.advisors_trading >= cfg.min_advisors
    AND rc.ratio >= cfg.min_ratio
    AND NOT EXISTS (
      SELECT 1 FROM public.alerts a
      WHERE a.rule_id = r.id AND a.month = v_month AND a.ticker = cur.ticker AND a.status IN ('open','acknowledged')
    );
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_inserted := v_inserted + v_rows;

  -- REDEMPTION_STREAK: N consecutive outflow months including current
  INSERT INTO public.alerts (rule_id, month, ticker, asset_class, severity, priority, status, title, summary, details, signal_value, net_flow, advisors_trading)
  WITH cfg AS (
    SELECT r.id AS rule_id,
           COALESCE((r.params->>'streak_months')::int, 3) AS streak,
           COALESCE((r.params->>'min_total_outflow')::numeric, 1000000) AS min_total_outflow,
           r.severity_default AS sev
    FROM public.alert_rules r
    WHERE r.is_active = true AND r.rule_type = 'REDEMPTION_STREAK'
  ),
  cur AS (
    SELECT ff.ticker,
           (ff.inflows - ff.outflows) AS net_flow,
           ff.advisors_trading
    FROM public.fund_flows_mv ff WHERE ff.month = v_month
  ),
  comb AS (
    SELECT c.rule_id, c.streak, c.min_total_outflow, c.sev, cur.ticker, cur.net_flow, cur.advisors_trading
    FROM cfg c
    CROSS JOIN cur
  ),
  wins AS (
    SELECT comb.rule_id,
           comb.ticker,
           comb.streak,
           comb.min_total_outflow,
           SUM(CASE WHEN (p.inflows - p.outflows) < 0 THEN 1 ELSE 0 END) AS neg_months,
           SUM(CASE WHEN (p.inflows - p.outflows) < 0 THEN (p.outflows - p.inflows) ELSE 0 END) AS total_outflow
    FROM comb
    LEFT JOIN generate_series(0, comb.streak - 1) g(k) ON TRUE
    LEFT JOIN public.fund_flows_mv p
      ON p.ticker = comb.ticker
     AND p.month = (v_month + INTERVAL '1 month')::date - (g.k || ' months')::interval
    GROUP BY comb.rule_id, comb.ticker, comb.streak, comb.min_total_outflow
  )
  SELECT w.rule_id,
         v_month AS month,
         w.ticker,
         COALESCE(f.asset_class, 'Unclassified') AS asset_class,
         COALESCE((SELECT sev FROM cfg WHERE rule_id = w.rule_id LIMIT 1), 'critical') AS severity,
         LEAST(100, GREATEST(10, 60 + (LN(GREATEST(1, w.total_outflow)) * 5)::int)) AS priority,
         'open' AS status,
         CONCAT('Redemption Streak for ', w.ticker) AS title,
         CONCAT(w.streak, ' months of outflows; Total ', w.total_outflow) AS summary,
         jsonb_build_object('type','REDEMPTION_STREAK','months', w.streak, 'total_outflow', w.total_outflow) AS details,
         w.streak AS signal_value,
         cur.net_flow AS net_flow,
         cur.advisors_trading AS advisors_trading
  FROM wins w
  JOIN cur ON cur.ticker = w.ticker
  LEFT JOIN public.funds f ON f.ticker = w.ticker
  WHERE w.neg_months = w.streak
    AND w.total_outflow >= w.min_total_outflow
    AND NOT EXISTS (
      SELECT 1 FROM public.alerts a WHERE a.rule_id = w.rule_id AND a.month = v_month AND a.ticker = w.ticker AND a.status IN ('open','acknowledged')
    );
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_inserted := v_inserted + v_rows;

  RETURN v_inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_alerts_for_month(date) TO anon, authenticated, service_role;

-- 5) Alerts retrieval and actions RPCs

-- List alerts with filters and pagination
CREATE OR REPLACE FUNCTION public.get_alerts(
  p_status text DEFAULT 'open',
  p_severity text DEFAULT NULL,
  p_asset_class text DEFAULT NULL,
  p_min_priority int DEFAULT NULL,
  p_limit int DEFAULT 100,
  p_after_id bigint DEFAULT NULL
)
RETURNS TABLE (
  id bigint,
  month date,
  ticker text,
  asset_class text,
  severity text,
  priority int,
  status text,
  title text,
  summary text,
  net_flow numeric,
  advisors_trading int,
  created_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
  SELECT a.id, a.month, a.ticker, a.asset_class, a.severity, a.priority, a.status, a.title, a.summary, a.net_flow, a.advisors_trading, a.created_at
  FROM public.alerts a
  WHERE (p_status IS NULL OR a.status = p_status)
    AND (p_severity IS NULL OR a.severity = p_severity)
    AND (p_asset_class IS NULL OR a.asset_class = p_asset_class)
    AND (p_min_priority IS NULL OR a.priority >= p_min_priority)
    AND (p_after_id IS NULL OR a.id < p_after_id)
  ORDER BY a.priority DESC, a.created_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 1000));
$$;

GRANT EXECUTE ON FUNCTION public.get_alerts(text, text, text, int, int, bigint) TO anon, authenticated, service_role;

-- Acknowledge alert
CREATE OR REPLACE FUNCTION public.acknowledge_alert(
  p_alert_id bigint,
  p_actor text DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.alerts SET status = 'acknowledged', acknowledged_at = now(), acknowledged_by = p_actor
  WHERE id = p_alert_id AND status = 'open';
  IF FOUND THEN
    INSERT INTO public.alert_actions (alert_id, action, actor, note) VALUES (p_alert_id, 'acknowledge', p_actor, p_note);
    RETURN true;
  END IF;
  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.acknowledge_alert(bigint, text, text) TO anon, authenticated, service_role;

-- Resolve alert
CREATE OR REPLACE FUNCTION public.resolve_alert(
  p_alert_id bigint,
  p_actor text DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.alerts SET status = 'resolved', resolved_at = now(), resolved_by = p_actor
  WHERE id = p_alert_id AND status IN ('open','acknowledged');
  IF FOUND THEN
    INSERT INTO public.alert_actions (alert_id, action, actor, note) VALUES (p_alert_id, 'resolve', p_actor, p_note);
    RETURN true;
  END IF;
  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_alert(bigint, text, text) TO anon, authenticated, service_role;

-- 6) Sample rules (initial defaults)
INSERT INTO public.alert_rules (name, description, rule_type, scope, severity_default, params, is_active)
VALUES
  (
    'Unusual Net Flow ±2σ (12M)',
    'Triggers when current month net flow is beyond ±2 standard deviations vs trailing 12-month history for the ticker.',
    'NET_FLOW_SIGMA', 'ticker', 'warning',
    jsonb_build_object('window_months', 12, 'sigma_threshold', 2.0),
    true
  ),
  (
    'Advisor Participation Spike ×1.5 (6M avg)',
    'Triggers when advisors_trading exceeds 1.5× trailing 6-month average (min 5 advisors).',
    'ADVISOR_SPIKE_RATIO', 'ticker', 'info',
    jsonb_build_object('window_months', 6, 'min_ratio', 1.5, 'min_advisors', 5),
    true
  ),
  (
    'Redemption Streak (3M)',
    'Triggers when there are 3 consecutive months of outflows including current month (min $1M total outflow across streak).',
    'REDEMPTION_STREAK', 'ticker', 'critical',
    jsonb_build_object('streak_months', 3, 'min_total_outflow', 1000000),
    true
  )
ON CONFLICT DO NOTHING;
