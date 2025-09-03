-- Migration: Holdings & Trades Foundation (tables, indexes, MVs, RPCs)
-- Phase 1 data infrastructure for advisor intelligence features

-- 1) Core tables

CREATE TABLE IF NOT EXISTS public.client_holdings (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  snapshot_date    date           NOT NULL,
  advisor_id       text           NOT NULL,
  client_id        text           NOT NULL, -- hashed (HMAC of account number)
  account_source   text           NULL,     -- optional hashed original account for audit
  ticker           text           NOT NULL,
  cusip            text           NULL,
  quantity         numeric(20,6)  NOT NULL,
  market_value     numeric(20,2)  NOT NULL,
  created_at       timestamptz    NOT NULL DEFAULT now(),
  UNIQUE (snapshot_date, advisor_id, client_id, ticker)
);

CREATE TABLE IF NOT EXISTS public.trade_activity (
  id                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  trade_date         date           NOT NULL,
  settlement_date    date           NULL,
  advisor_id         text           NOT NULL,
  client_id          text           NOT NULL, -- hashed (HMAC of account number)
  account_source     text           NULL,     -- optional hashed original account for audit
  external_trade_id  text           NULL,     -- trade number for dedupe
  ticker             text           NULL,
  cusip              text           NULL,
  trade_type         text           NOT NULL CHECK (trade_type IN ('BUY','SELL')),
  product_type       text           NULL,
  quantity           numeric(20,6)  NULL,
  principal_amount   numeric(20,2)  NULL,     -- signed: BUY > 0, SELL < 0
  cancelled          boolean        NOT NULL DEFAULT false,
  created_at         timestamptz    NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_client_holdings_date ON public.client_holdings (snapshot_date);
CREATE INDEX IF NOT EXISTS idx_client_holdings_advisor ON public.client_holdings (advisor_id, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_client_holdings_ticker ON public.client_holdings (ticker);

CREATE INDEX IF NOT EXISTS idx_trade_activity_date ON public.trade_activity (trade_date);
CREATE INDEX IF NOT EXISTS idx_trade_activity_advisor ON public.trade_activity (advisor_id, trade_date);
CREATE INDEX IF NOT EXISTS idx_trade_activity_ticker ON public.trade_activity (ticker, trade_date);
CREATE UNIQUE INDEX IF NOT EXISTS ux_trade_activity_extid ON public.trade_activity (external_trade_id) WHERE external_trade_id IS NOT NULL;

-- Align with current project security posture (RLS disabled for internal app)
ALTER TABLE public.client_holdings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_activity DISABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.client_holdings TO anon, authenticated, service_role;
GRANT SELECT ON public.trade_activity TO anon, authenticated, service_role;

-- 2) Materialized Views

-- Advisor-level AUM and counts by snapshot_date
CREATE MATERIALIZED VIEW IF NOT EXISTS public.advisor_metrics_mv AS
SELECT
  ch.snapshot_date,
  ch.advisor_id,
  COUNT(DISTINCT ch.client_id)    AS client_count,
  COUNT(DISTINCT ch.ticker)       AS unique_holdings,
  SUM(ch.market_value)            AS aum
FROM public.client_holdings ch
GROUP BY ch.snapshot_date, ch.advisor_id;

-- Unique index to allow CONCURRENTLY refreshes
CREATE UNIQUE INDEX IF NOT EXISTS ux_advisor_metrics_mv
ON public.advisor_metrics_mv (snapshot_date, advisor_id);

-- Fund-level flows by month using signed principals
CREATE MATERIALIZED VIEW IF NOT EXISTS public.fund_flows_mv AS
SELECT
  DATE_TRUNC('month', ta.trade_date)::date AS month,
  ta.ticker,
  SUM(CASE WHEN ta.trade_type = 'BUY'  AND NOT ta.cancelled THEN ta.principal_amount ELSE 0 END)       AS inflows,
  SUM(CASE WHEN ta.trade_type = 'SELL' AND NOT ta.cancelled THEN -ta.principal_amount ELSE 0 END)      AS outflows,
  COUNT(DISTINCT ta.advisor_id) AS advisors_trading
FROM public.trade_activity ta
WHERE ta.ticker IS NOT NULL
GROUP BY DATE_TRUNC('month', ta.trade_date)::date, ta.ticker;

CREATE UNIQUE INDEX IF NOT EXISTS ux_fund_flows_mv
ON public.fund_flows_mv (month, ticker);

GRANT SELECT ON public.advisor_metrics_mv TO anon, authenticated, service_role;
GRANT SELECT ON public.fund_flows_mv TO anon, authenticated, service_role;

-- 3) Refresh RPCs

CREATE OR REPLACE FUNCTION public.refresh_advisor_metrics_mv()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.advisor_metrics_mv;
$$;

CREATE OR REPLACE FUNCTION public.refresh_fund_flows_mv()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.fund_flows_mv;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_advisor_metrics_mv() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.refresh_fund_flows_mv() TO anon, authenticated, service_role;

-- 4) Retrieval RPCs

-- Advisor metrics for a specific snapshot_date (EOM)
CREATE OR REPLACE FUNCTION public.get_advisor_metrics(
  p_date date,
  p_advisor_id text DEFAULT NULL
)
RETURNS TABLE (
  snapshot_date date,
  advisor_id text,
  client_count int,
  unique_holdings int,
  aum numeric
)
LANGUAGE sql
STABLE
AS $$
  SELECT am.snapshot_date, am.advisor_id, am.client_count, am.unique_holdings, am.aum
  FROM public.advisor_metrics_mv am
  WHERE am.snapshot_date = p_date
    AND (p_advisor_id IS NULL OR am.advisor_id = p_advisor_id)
  ORDER BY am.aum DESC, am.advisor_id ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_advisor_metrics(date, text) TO anon, authenticated, service_role;

-- Fund flows for a given month or latest month in MV
CREATE OR REPLACE FUNCTION public.get_fund_flows(
  p_month date DEFAULT NULL,
  p_ticker text DEFAULT NULL,
  p_limit int DEFAULT 100
)
RETURNS TABLE (
  month date,
  ticker text,
  inflows numeric,
  outflows numeric,
  net_flow numeric,
  advisors_trading int
)
LANGUAGE sql
STABLE
AS $$
  WITH pick AS (
    SELECT COALESCE(p_month, (SELECT MAX(month) FROM public.fund_flows_mv)) AS m
  )
  SELECT f.month, f.ticker, f.inflows, f.outflows, (f.inflows - f.outflows) AS net_flow, f.advisors_trading
  FROM public.fund_flows_mv f
  CROSS JOIN pick
  WHERE f.month = pick.m
    AND (p_ticker IS NULL OR f.ticker = p_ticker)
  ORDER BY ABS(f.inflows - f.outflows) DESC, f.ticker ASC
  LIMIT GREATEST(1, LEAST(p_limit, 1000));
$$;

GRANT EXECUTE ON FUNCTION public.get_fund_flows(date, text, int) TO anon, authenticated, service_role;
