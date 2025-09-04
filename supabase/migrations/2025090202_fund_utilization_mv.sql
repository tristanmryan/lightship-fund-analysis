-- Phase 2: Fund Utilization materialized view and RPCs

-- Materialized view: fund utilization by snapshot and ticker
CREATE MATERIALIZED VIEW IF NOT EXISTS public.fund_utilization_mv AS
SELECT
  ch.snapshot_date,
  ch.ticker,
  COALESCE(f.asset_class, 'Unclassified') AS asset_class,
  SUM(ch.market_value)                   AS total_aum,
  COUNT(DISTINCT ch.advisor_id)         AS advisors_using,
  COUNT(DISTINCT ch.client_id)          AS clients_using,
  AVG(ch.market_value)                  AS avg_position_usd
FROM public.client_holdings ch
LEFT JOIN public.funds f ON f.ticker = ch.ticker
GROUP BY ch.snapshot_date, ch.ticker, COALESCE(f.asset_class, 'Unclassified');

CREATE UNIQUE INDEX IF NOT EXISTS ux_fund_utilization_mv
ON public.fund_utilization_mv (snapshot_date, ticker);

CREATE INDEX IF NOT EXISTS idx_fund_utilization_aum
ON public.fund_utilization_mv (snapshot_date, total_aum DESC);

GRANT SELECT ON public.fund_utilization_mv TO anon, authenticated, service_role;

-- Refresh function
CREATE OR REPLACE FUNCTION public.refresh_fund_utilization_mv()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.fund_utilization_mv;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_fund_utilization_mv() TO anon, authenticated, service_role;

-- Retrieval RPCs
CREATE OR REPLACE FUNCTION public.get_fund_utilization(
  p_date date,
  p_asset_class text DEFAULT NULL,
  p_limit int DEFAULT 200
)
RETURNS TABLE (
  snapshot_date date,
  ticker text,
  asset_class text,
  total_aum numeric,
  advisors_using int,
  clients_using int,
  avg_position_usd numeric
)
LANGUAGE sql
STABLE
AS $$
  SELECT u.snapshot_date, u.ticker, u.asset_class, u.total_aum, u.advisors_using, u.clients_using, u.avg_position_usd
  FROM public.fund_utilization_mv u
  WHERE u.snapshot_date = p_date
    AND (p_asset_class IS NULL OR u.asset_class = p_asset_class)
  ORDER BY u.total_aum DESC, u.ticker ASC
  LIMIT GREATEST(1, LEAST(p_limit, 2000));
$$;

GRANT EXECUTE ON FUNCTION public.get_fund_utilization(date, text, int) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_fund_adoption_trend(
  p_ticker text,
  p_limit_months int DEFAULT 12
)
RETURNS TABLE (
  snapshot_date date,
  total_aum numeric,
  advisors_using int,
  clients_using int
)
LANGUAGE sql
STABLE
AS $$
  SELECT u.snapshot_date, u.total_aum, u.advisors_using, u.clients_using
  FROM public.fund_utilization_mv u
  WHERE u.ticker = p_ticker
  ORDER BY u.snapshot_date DESC
  LIMIT GREATEST(1, LEAST(p_limit_months, 60));
$$;

GRANT EXECUTE ON FUNCTION public.get_fund_adoption_trend(text, int) TO anon, authenticated, service_role;

