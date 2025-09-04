-- Phase 3: Performance indexes for frequent filters and sorts
-- Funds flags and grouping
CREATE INDEX IF NOT EXISTS idx_funds_is_recommended ON public.funds (is_recommended);
CREATE INDEX IF NOT EXISTS idx_funds_asset_class ON public.funds (asset_class);

-- Fund performance snapshot queries
CREATE INDEX IF NOT EXISTS idx_fund_performance_date ON public.fund_performance (date);
CREATE INDEX IF NOT EXISTS idx_fund_performance_ticker_date ON public.fund_performance (fund_ticker, date DESC);

-- Benchmark performance snapshot queries
CREATE INDEX IF NOT EXISTS idx_benchmark_performance_date ON public.benchmark_performance (date);
CREATE INDEX IF NOT EXISTS idx_benchmark_performance_ticker_date ON public.benchmark_performance (benchmark_ticker, date DESC);

-- Trade activity fallbacks (month/ticker filters)
CREATE INDEX IF NOT EXISTS idx_trade_activity_date ON public.trade_activity (trade_date);
CREATE INDEX IF NOT EXISTS idx_trade_activity_ticker_date ON public.trade_activity (ticker, trade_date DESC);

-- Materialized views frequently filtered by month/ticker
-- These may fail if view names differ in some environments; safe to ignore if not present
DO $$ BEGIN
  PERFORM 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'm' AND n.nspname = 'public' AND c.relname = 'fund_flows_mv';
  IF FOUND THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_fund_flows_mv_month ON public.fund_flows_mv (month)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_fund_flows_mv_ticker ON public.fund_flows_mv (ticker)';
  END IF;
END $$;