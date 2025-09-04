-- Ensure ON CONFLICT can target external_trade_id
-- Partial unique indexes cannot be used with ON CONFLICT (column_list). Create a full unique index.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' AND indexname = 'ux_trade_activity_extid_all'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX ux_trade_activity_extid_all ON public.trade_activity (external_trade_id)';
  END IF;
END $$;


