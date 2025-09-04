-- Phase 2 fix: add price column to trade_activity to match importer mapping
ALTER TABLE public.trade_activity
  ADD COLUMN IF NOT EXISTS price numeric(20,6) NULL;

-- No additional grants required (inherits table privileges)


