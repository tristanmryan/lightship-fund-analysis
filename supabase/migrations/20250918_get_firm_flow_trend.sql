-- Firm-wide flow trend RPC to support Trading dashboard coverage beyond default REST limit
CREATE OR REPLACE FUNCTION public.get_firm_flow_trend(
  p_limit_months int DEFAULT 36,
  p_min_month date DEFAULT NULL
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
  WITH monthly AS (
    SELECT
      f.month,
      COALESCE(SUM(f.inflows), 0)::numeric AS inflows,
      COALESCE(SUM(f.outflows), 0)::numeric AS outflows,
      COALESCE(SUM(f.inflows - f.outflows), 0)::numeric AS net_flow
    FROM public.fund_flows_mv f
    WHERE (p_min_month IS NULL OR f.month >= p_min_month)
    GROUP BY f.month
  ), limited AS (
    SELECT m.month, m.inflows, m.outflows, m.net_flow
    FROM monthly m
    ORDER BY m.month DESC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit_months, 36), 120))
  )
  SELECT l.month, l.inflows, l.outflows, l.net_flow
  FROM limited l
  ORDER BY l.month ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_firm_flow_trend(int, date) TO anon, authenticated, service_role;
