-- Phase 5: Rules Admin hardening, RBAC grants, assignment helper, and index tuning

-- 1) RBAC: Allow DML on alert_rules for app (RLS disabled; rely on app auth)
DO $$
BEGIN
  BEGIN
    GRANT INSERT, UPDATE, DELETE ON public.alert_rules TO anon, authenticated;
  EXCEPTION WHEN OTHERS THEN
    -- ignore if role missing in local envs
    NULL;
  END;
END $$;

-- 2) Param constraints per rule_type (best-effort, with sensible defaults)
-- Use named constraints and add them if not present
DO $$
DECLARE
  has1 boolean; has2 boolean; has3 boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_alert_rules_net_flow_sigma'
  ) INTO has1;
  IF NOT has1 THEN
    ALTER TABLE public.alert_rules
    ADD CONSTRAINT chk_alert_rules_net_flow_sigma
    CHECK (
      rule_type <> 'NET_FLOW_SIGMA'
      OR (
        COALESCE( (params->>'window_months')::int, 12) >= 3
        AND COALESCE( (params->>'sigma_threshold')::numeric, 2.0) BETWEEN 1 AND 5
      )
    );
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_alert_rules_advisor_spike_ratio'
  ) INTO has2;
  IF NOT has2 THEN
    ALTER TABLE public.alert_rules
    ADD CONSTRAINT chk_alert_rules_advisor_spike_ratio
    CHECK (
      rule_type <> 'ADVISOR_SPIKE_RATIO'
      OR (
        COALESCE( (params->>'window_months')::int, 6) >= 3
        AND COALESCE( (params->>'min_ratio')::numeric, 1.5) >= 1
        AND COALESCE( (params->>'min_advisors')::int, 5) >= 1
      )
    );
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_alert_rules_redemption_streak'
  ) INTO has3;
  IF NOT has3 THEN
    ALTER TABLE public.alert_rules
    ADD CONSTRAINT chk_alert_rules_redemption_streak
    CHECK (
      rule_type <> 'REDEMPTION_STREAK'
      OR (
        COALESCE( (params->>'streak_months')::int, 3) >= 2
        AND COALESCE( (params->>'min_total_outflow')::numeric, 1000000) >= 0
      )
    );
  END IF;
END $$;

-- 3) Assignment helper: add assigned_to and RPC to set it with audit
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'alerts' AND column_name = 'assigned_to'
  ) THEN
    ALTER TABLE public.alerts ADD COLUMN assigned_to text NULL;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.assign_alert(
  p_alert_id bigint,
  p_assigned_to text,
  p_actor text DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.alerts SET assigned_to = NULLIF(TRIM(p_assigned_to), '')
  WHERE id = p_alert_id;
  IF FOUND THEN
    INSERT INTO public.alert_actions (alert_id, action, actor, note)
    VALUES (p_alert_id, 'assign', p_actor, COALESCE(p_note, CONCAT('Assigned to ', NULLIF(TRIM(p_assigned_to), ''))));
    RETURN true;
  END IF;
  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_alert(bigint, text, text, text) TO anon, authenticated, service_role;

-- 4) Tuning index for common filters: (asset_class, status, priority desc)
CREATE INDEX IF NOT EXISTS idx_alerts_asset_status_priority
  ON public.alerts (asset_class, status, priority DESC, created_at DESC);

-- 5) Extend get_alerts to return assigned_to
-- Drop old definition first to allow changing OUT columns (RETURNS TABLE)
DROP FUNCTION IF EXISTS public.get_alerts(text, text, text, integer, integer, bigint);

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
  assigned_to text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
  SELECT a.id, a.month, a.ticker, a.asset_class, a.severity, a.priority, a.status, a.title, a.summary, a.net_flow, a.advisors_trading, a.assigned_to, a.created_at
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

-- 6) Guardrail: optional cap parameter for refresh_alerts_for_month
-- Recreate with p_max_inserts (keeps compatibility via default)
CREATE OR REPLACE FUNCTION public.refresh_alerts_for_month(
  p_month date DEFAULT NULL,
  p_max_inserts int DEFAULT 20000
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

  -- NET_FLOW_SIGMA
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
         jsonb_build_object('type','NET_FLOW_SIGMA','window_months', win,'z', z,'mean', mean,'stddev', stddev) AS details,
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

  -- ADVISOR_SPIKE_RATIO
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
         jsonb_build_object('type','ADVISOR_SPIKE_RATIO','window_months', win,'ratio', ratio,'avg', trailing_avg) AS details,
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

  -- REDEMPTION_STREAK
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

  -- Guardrail: cap total inserts (post-insert enforcement via trimming newest rows)
  IF p_max_inserts IS NOT NULL AND v_inserted > p_max_inserts THEN
    DELETE FROM public.alerts a
    USING (
      SELECT id FROM public.alerts
      WHERE month = v_month
      ORDER BY priority ASC, created_at DESC
      OFFSET p_max_inserts
    ) x
    WHERE a.id = x.id;
    v_inserted := p_max_inserts;
  END IF;

  RETURN v_inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_alerts_for_month(date, int) TO anon, authenticated, service_role;
