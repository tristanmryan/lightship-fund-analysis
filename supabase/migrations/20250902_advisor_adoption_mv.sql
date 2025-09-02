-- Phase 2: Advisor recommendation adoption MV and RPCs

-- Materialized view: advisor adoption by snapshot
CREATE MATERIALIZED VIEW IF NOT EXISTS public.advisor_adoption_mv AS
SELECT
  ch.snapshot_date,
  ch.advisor_id,
  SUM(ch.market_value) AS total_aum,
  SUM(CASE WHEN f.is_recommended THEN ch.market_value ELSE 0 END) AS recommended_aum
FROM public.client_holdings ch
LEFT JOIN public.funds f ON f.ticker = ch.ticker
GROUP BY ch.snapshot_date, ch.advisor_id;

CREATE UNIQUE INDEX IF NOT EXISTS ux_advisor_adoption_mv
ON public.advisor_adoption_mv (snapshot_date, advisor_id);

GRANT SELECT ON public.advisor_adoption_mv TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.refresh_advisor_adoption_mv()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.advisor_adoption_mv;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_advisor_adoption_mv() TO anon, authenticated, service_role;

-- Adoption trend for an advisor (most recent N months)
CREATE OR REPLACE FUNCTION public.get_advisor_adoption_trend(
  p_advisor_id text,
  p_limit_months int DEFAULT 12
)
RETURNS TABLE (
  snapshot_date date,
  total_aum numeric,
  recommended_aum numeric,
  adoption_pct numeric
)
LANGUAGE sql
STABLE
AS $$
  SELECT a.snapshot_date,
         a.total_aum,
         a.recommended_aum,
         CASE WHEN a.total_aum > 0 THEN a.recommended_aum / a.total_aum ELSE 0 END AS adoption_pct
  FROM public.advisor_adoption_mv a
  WHERE a.advisor_id = p_advisor_id
  ORDER BY a.snapshot_date DESC
  LIMIT GREATEST(1, LEAST(p_limit_months, 60));
$$;

GRANT EXECUTE ON FUNCTION public.get_advisor_adoption_trend(text, int) TO anon, authenticated, service_role;

