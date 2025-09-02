-- Phase 3: Trade Flow RPCs

-- Top movers by month with optional asset class filter
CREATE OR REPLACE FUNCTION public.get_top_movers(
  p_month date DEFAULT NULL,
  p_direction text DEFAULT 'inflow',
  p_asset_class text DEFAULT NULL,
  p_limit int DEFAULT 10
)
RETURNS TABLE (
  month date,
  ticker text,
  inflows numeric,
  outflows numeric,
  net_flow numeric,
  advisors_trading int,
  asset_class text
)
LANGUAGE sql
STABLE
AS $$
  WITH pick AS (
    SELECT COALESCE(p_month, (SELECT MAX(month) FROM public.fund_flows_mv)) AS m
  ), base AS (
    SELECT f.month, f.ticker, f.inflows, f.outflows, (f.inflows - f.outflows) AS net_flow, f.advisors_trading,
           COALESCE(fd.asset_class, 'Unclassified') AS asset_class
    FROM public.fund_flows_mv f
    JOIN pick ON f.month = pick.m
    LEFT JOIN public.funds fd ON fd.ticker = f.ticker
    WHERE (p_asset_class IS NULL OR fd.asset_class = p_asset_class)
  )
  SELECT b.month, b.ticker, b.inflows, b.outflows, b.net_flow, b.advisors_trading, b.asset_class
  FROM base b
  ORDER BY (CASE WHEN LOWER(COALESCE(p_direction,'inflow')) IN ('outflow','sell','selling','down') THEN 1 ELSE -1 END) * b.net_flow ASC,
           b.ticker ASC
  LIMIT GREATEST(1, LEAST(p_limit, 1000));
$$;

GRANT EXECUTE ON FUNCTION public.get_top_movers(date, text, text, int) TO anon, authenticated, service_role;

-- Advisor participation summary (buying vs selling) for a month
CREATE OR REPLACE FUNCTION public.get_advisor_participation(
  p_month date DEFAULT NULL,
  p_ticker text DEFAULT NULL
)
RETURNS TABLE (
  advisors_buying int,
  advisors_selling int,
  advisors_neutral int,
  advisors_total int
)
LANGUAGE sql
STABLE
AS $$
  WITH pick AS (
    SELECT COALESCE(p_month, (SELECT MAX(DATE_TRUNC('month', trade_date)::date) FROM public.trade_activity)) AS m
  ), base AS (
    SELECT ta.advisor_id,
           SUM(
             CASE WHEN NOT ta.cancelled THEN
               (CASE WHEN ta.trade_type = 'SELL' THEN -1 ELSE 1 END) * COALESCE(ta.principal_amount, 0)
             ELSE 0 END
           ) AS signed_principal
    FROM public.trade_activity ta
    JOIN pick ON DATE_TRUNC('month', ta.trade_date)::date = pick.m
    WHERE (p_ticker IS NULL OR ta.ticker = p_ticker)
    GROUP BY ta.advisor_id
  )
  SELECT
    SUM(CASE WHEN signed_principal > 0 THEN 1 ELSE 0 END) AS advisors_buying,
    SUM(CASE WHEN signed_principal < 0 THEN 1 ELSE 0 END) AS advisors_selling,
    SUM(CASE WHEN signed_principal = 0 THEN 1 ELSE 0 END) AS advisors_neutral,
    COUNT(*) AS advisors_total
  FROM base;
$$;

GRANT EXECUTE ON FUNCTION public.get_advisor_participation(date, text) TO anon, authenticated, service_role;

-- Flow aggregation by asset class for a month
CREATE OR REPLACE FUNCTION public.get_flow_by_asset_class(
  p_month date DEFAULT NULL
)
RETURNS TABLE (
  asset_class text,
  inflows numeric,
  outflows numeric,
  net_flow numeric,
  funds_traded int,
  advisors_trading int
)
LANGUAGE sql
STABLE
AS $$
  WITH pick AS (
    SELECT COALESCE(p_month, (SELECT MAX(month) FROM public.fund_flows_mv)) AS m
  )
  SELECT COALESCE(fd.asset_class, 'Unclassified') AS asset_class,
         SUM(f.inflows) AS inflows,
         SUM(f.outflows) AS outflows,
         SUM(f.inflows - f.outflows) AS net_flow,
         COUNT(*) AS funds_traded,
         SUM(f.advisors_trading) AS advisors_trading
  FROM public.fund_flows_mv f
  JOIN pick ON f.month = pick.m
  LEFT JOIN public.funds fd ON fd.ticker = f.ticker
  GROUP BY COALESCE(fd.asset_class, 'Unclassified')
  ORDER BY net_flow DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_flow_by_asset_class(date) TO anon, authenticated, service_role;

