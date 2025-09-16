-- Phase 3: Advisor-aware Trading RPCs
-- Adds RPCs for advisor/team filtered flows, monthly trends, and per-ticker drilldown

-- get_advisor_flows: per-ticker flows for a given month and advisor set
CREATE OR REPLACE FUNCTION public.get_advisor_flows(
  p_month date,
  p_advisor_ids text[] DEFAULT NULL,
  p_limit int DEFAULT 50
)
RETURNS TABLE (
  ticker text,
  inflows numeric,
  outflows numeric,
  net_flow numeric,
  advisors_trading int
)
LANGUAGE sql
STABLE
AS $$
  WITH filtered AS (
    SELECT
      ta.ticker,
      ta.advisor_id,
      ta.trade_type,
      ta.principal_amount,
      ta.cancelled
    FROM public.trade_activity ta
    WHERE ta.ticker IS NOT NULL
      AND (p_month IS NULL OR DATE_TRUNC('month', ta.trade_date)::date = p_month)
      AND (COALESCE(array_length(p_advisor_ids, 1), 0) = 0 OR ta.advisor_id = ANY (p_advisor_ids))
      AND NOT ta.cancelled
  ), agg AS (
    SELECT
      f.ticker,
      SUM(CASE WHEN f.trade_type = 'BUY'  THEN f.principal_amount ELSE 0 END)     AS inflows,
      SUM(CASE WHEN f.trade_type = 'SELL' THEN -f.principal_amount ELSE 0 END)    AS outflows,
      COUNT(DISTINCT f.advisor_id)                                                AS advisors_trading
    FROM filtered f
    GROUP BY f.ticker
  )
  SELECT a.ticker, a.inflows, a.outflows, (a.inflows - a.outflows) AS net_flow, a.advisors_trading
  FROM agg a
  ORDER BY ABS(a.inflows - a.outflows) DESC, a.ticker ASC
  LIMIT GREATEST(1, LEAST(p_limit, 1000));
$$;

GRANT EXECUTE ON FUNCTION public.get_advisor_flows(date, text[], int) TO anon, authenticated, service_role;

-- get_advisor_flow_trend: monthly net flows for last N months for advisor set
CREATE OR REPLACE FUNCTION public.get_advisor_flow_trend(
  p_advisor_ids text[] DEFAULT NULL,
  p_limit_months int DEFAULT 8
)
RETURNS TABLE (
  month date,
  inflows numeric,
  outflows numeric,
  net_flow numeric
)
LANGUAGE sql
STABLE
AS $$
  WITH filtered AS (
    SELECT DATE_TRUNC('month', ta.trade_date)::date AS month,
           ta.trade_type,
           ta.principal_amount,
           ta.cancelled,
           ta.advisor_id
    FROM public.trade_activity ta
    WHERE (COALESCE(array_length(p_advisor_ids, 1), 0) = 0 OR ta.advisor_id = ANY (p_advisor_ids))
      AND NOT ta.cancelled
  ), agg AS (
    SELECT f.month,
           SUM(CASE WHEN f.trade_type = 'BUY'  THEN f.principal_amount ELSE 0 END)  AS inflows,
           SUM(CASE WHEN f.trade_type = 'SELL' THEN -f.principal_amount ELSE 0 END) AS outflows
    FROM filtered f
    GROUP BY f.month
  ), limited AS (
    SELECT a.month, a.inflows, a.outflows, (a.inflows - a.outflows) AS net_flow
    FROM agg a
    ORDER BY a.month DESC
    LIMIT GREATEST(1, LEAST(p_limit_months, 60))
  )
  SELECT month, inflows, outflows, net_flow
  FROM limited
  ORDER BY month ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_advisor_flow_trend(text[], int) TO anon, authenticated, service_role;

-- get_advisor_ticker_breakdown: BUY/SELL counts and amounts for a ticker in a month, with per-advisor rows
CREATE OR REPLACE FUNCTION public.get_advisor_ticker_breakdown(
  p_month date,
  p_advisor_ids text[] DEFAULT NULL,
  p_ticker text DEFAULT NULL
)
RETURNS TABLE (
  advisor_id text,
  buy_trades int,
  sell_trades int,
  buy_amount numeric,
  sell_amount numeric,
  net_flow numeric,
  is_summary boolean
)
LANGUAGE sql
STABLE
AS $$
  WITH filtered AS (
    SELECT ta.advisor_id,
           ta.trade_type,
           ta.principal_amount,
           ta.cancelled
    FROM public.trade_activity ta
    WHERE ta.ticker = p_ticker
      AND (p_month IS NULL OR DATE_TRUNC('month', ta.trade_date)::date = p_month)
      AND (COALESCE(array_length(p_advisor_ids, 1), 0) = 0 OR ta.advisor_id = ANY (p_advisor_ids))
      AND NOT ta.cancelled
  ), per_advisor AS (
    SELECT
      f.advisor_id,
      SUM(CASE WHEN f.trade_type = 'BUY'  THEN 1 ELSE 0 END)                         AS buy_trades,
      SUM(CASE WHEN f.trade_type = 'SELL' THEN 1 ELSE 0 END)                         AS sell_trades,
      SUM(CASE WHEN f.trade_type = 'BUY'  THEN f.principal_amount ELSE 0 END)        AS buy_amount,
      SUM(CASE WHEN f.trade_type = 'SELL' THEN -f.principal_amount ELSE 0 END)       AS sell_amount
    FROM filtered f
    GROUP BY f.advisor_id
  ), summary AS (
    SELECT
      NULL::text AS advisor_id,
      SUM(buy_trades)  AS buy_trades,
      SUM(sell_trades) AS sell_trades,
      SUM(buy_amount)  AS buy_amount,
      SUM(sell_amount) AS sell_amount
    FROM per_advisor
  )
  SELECT pa.advisor_id,
         pa.buy_trades,
         pa.sell_trades,
         pa.buy_amount,
         pa.sell_amount,
         (COALESCE(pa.buy_amount,0) - COALESCE(pa.sell_amount,0)) AS net_flow,
         false AS is_summary
  FROM per_advisor pa
  UNION ALL
  SELECT s.advisor_id,
         s.buy_trades,
         s.sell_trades,
         s.buy_amount,
         s.sell_amount,
         (COALESCE(s.buy_amount,0) - COALESCE(s.sell_amount,0)) AS net_flow,
         true AS is_summary
  FROM summary s
  ORDER BY is_summary ASC, net_flow DESC, advisor_id NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.get_advisor_ticker_breakdown(date, text[], text) TO anon, authenticated, service_role;

-- get_advisor_month_kpis: KPIs for selected month and advisors
CREATE OR REPLACE FUNCTION public.get_advisor_month_kpis(
  p_month date,
  p_advisor_ids text[] DEFAULT NULL
)
RETURNS TABLE (
  total_inflows numeric,
  total_outflows numeric,
  net_flow numeric,
  distinct_tickers int,
  advisors_trading int
)
LANGUAGE sql
STABLE
AS $$
  WITH filtered AS (
    SELECT ta.ticker, ta.advisor_id, ta.trade_type, ta.principal_amount
    FROM public.trade_activity ta
    WHERE (p_month IS NULL OR DATE_TRUNC('month', ta.trade_date)::date = p_month)
      AND (COALESCE(array_length(p_advisor_ids, 1), 0) = 0 OR ta.advisor_id = ANY (p_advisor_ids))
      AND NOT ta.cancelled
      AND ta.ticker IS NOT NULL
  ), agg AS (
    SELECT
      SUM(CASE WHEN f.trade_type = 'BUY'  THEN f.principal_amount ELSE 0 END)   AS inflows,
      SUM(CASE WHEN f.trade_type = 'SELL' THEN -f.principal_amount ELSE 0 END)  AS outflows,
      COUNT(DISTINCT f.ticker)                                                 AS tickers,
      COUNT(DISTINCT f.advisor_id)                                             AS advisors
    FROM filtered f
  )
  SELECT inflows AS total_inflows,
         outflows AS total_outflows,
         (COALESCE(inflows,0) - COALESCE(outflows,0)) AS net_flow,
         tickers AS distinct_tickers,
         advisors AS advisors_trading
  FROM agg;
$$;

GRANT EXECUTE ON FUNCTION public.get_advisor_month_kpis(date, text[]) TO anon, authenticated, service_role;

