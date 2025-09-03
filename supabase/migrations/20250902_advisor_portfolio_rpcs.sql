-- Phase 2: Advisor portfolio pre-aggregation RPCs

-- Allocation by asset class for a given advisor and snapshot
CREATE OR REPLACE FUNCTION public.get_advisor_portfolio_allocation(
  p_date date,
  p_advisor_id text
)
RETURNS TABLE (
  asset_class text,
  amount numeric,
  pct numeric
)
LANGUAGE sql
STABLE
AS $$
  WITH holdings AS (
    SELECT ch.ticker, ch.market_value
    FROM public.client_holdings ch
    WHERE ch.snapshot_date = p_date
      AND ch.advisor_id = p_advisor_id
  ), total AS (
    SELECT COALESCE(SUM(market_value), 0) AS aum FROM holdings
  )
  SELECT
    COALESCE(f.asset_class, 'Unclassified') AS asset_class,
    SUM(h.market_value) AS amount,
    CASE WHEN t.aum > 0 THEN SUM(h.market_value) / t.aum ELSE 0 END AS pct
  FROM holdings h
  LEFT JOIN public.funds f ON f.ticker = h.ticker
  CROSS JOIN total t
  GROUP BY COALESCE(f.asset_class, 'Unclassified'), t.aum
  ORDER BY amount DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_advisor_portfolio_allocation(date, text) TO anon, authenticated, service_role;

-- Top positions by ticker for a given advisor and snapshot
CREATE OR REPLACE FUNCTION public.get_advisor_positions(
  p_date date,
  p_advisor_id text,
  p_limit int DEFAULT 100
)
RETURNS TABLE (
  ticker text,
  amount numeric,
  pct numeric,
  is_recommended boolean
)
LANGUAGE sql
STABLE
AS $$
  WITH holdings AS (
    SELECT ch.ticker, SUM(ch.market_value) AS mv
    FROM public.client_holdings ch
    WHERE ch.snapshot_date = p_date
      AND ch.advisor_id = p_advisor_id
    GROUP BY ch.ticker
  ), total AS (
    SELECT COALESCE(SUM(mv), 0) AS aum FROM holdings
  )
  SELECT
    h.ticker,
    h.mv AS amount,
    CASE WHEN t.aum > 0 THEN h.mv / t.aum ELSE 0 END AS pct,
    COALESCE(f.is_recommended, false) AS is_recommended
  FROM holdings h
  LEFT JOIN public.funds f ON f.ticker = h.ticker
  CROSS JOIN total t
  ORDER BY h.mv DESC, h.ticker ASC
  LIMIT GREATEST(1, LEAST(p_limit, 1000));
$$;

GRANT EXECUTE ON FUNCTION public.get_advisor_positions(date, text, int) TO anon, authenticated, service_role;

