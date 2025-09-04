-- Phase 4: RPC timings capture for Vercel

CREATE TABLE IF NOT EXISTS public.rpc_timings (
  id           bigserial PRIMARY KEY,
  ts           timestamptz NOT NULL DEFAULT now(),
  name         text        NOT NULL,
  duration_ms  numeric     NOT NULL,
  labels       jsonb       NULL
);

CREATE INDEX IF NOT EXISTS idx_rpc_timings_name_ts ON public.rpc_timings (name, ts DESC);
ALTER TABLE public.rpc_timings DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.rpc_timings TO anon, authenticated, service_role;

-- P95 over a window
CREATE OR REPLACE FUNCTION public.get_rpc_p95(
  p_name text,
  p_since interval DEFAULT INTERVAL '7 days'
)
RETURNS TABLE (
  name text,
  p95_ms numeric,
  n int
)
LANGUAGE sql
STABLE
AS $$
  SELECT p_name AS name,
         PERCENTILE_DISC(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95_ms,
         COUNT(*) AS n
  FROM public.rpc_timings
  WHERE name = p_name
    AND ts >= now() - p_since;
$$;

GRANT EXECUTE ON FUNCTION public.get_rpc_p95(text, interval) TO anon, authenticated, service_role;

