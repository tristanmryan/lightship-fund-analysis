-- Simple Weight Storage Table for Clean Scoring System
-- This table stores asset class-specific weight overrides
-- Falls back to global defaults when no custom weights exist

CREATE TABLE IF NOT EXISTS scoring_weights_simple (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_class_id UUID NOT NULL REFERENCES asset_classes(id) ON DELETE CASCADE,
  metric_key TEXT NOT NULL,
  weight NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one weight per metric per asset class
  UNIQUE(asset_class_id, metric_key)
);

-- Index for fast asset class weight lookups
CREATE INDEX IF NOT EXISTS idx_scoring_weights_simple_asset_class 
ON scoring_weights_simple(asset_class_id);

-- Index for metric queries
CREATE INDEX IF NOT EXISTS idx_scoring_weights_simple_metric 
ON scoring_weights_simple(metric_key);

-- RLS policies (if needed in future)
-- For now, table is open to authenticated users
ALTER TABLE scoring_weights_simple ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all weights
CREATE POLICY IF NOT EXISTS "Enable read access for authenticated users" 
ON scoring_weights_simple FOR SELECT 
USING (auth.role() = 'authenticated');

-- Allow authenticated users to insert/update/delete weights
CREATE POLICY IF NOT EXISTS "Enable write access for authenticated users" 
ON scoring_weights_simple FOR ALL 
USING (auth.role() = 'authenticated');

-- Add comments for documentation
COMMENT ON TABLE scoring_weights_simple IS 'Asset class-specific weight overrides for the clean scoring system';
COMMENT ON COLUMN scoring_weights_simple.asset_class_id IS 'Reference to asset_classes table';
COMMENT ON COLUMN scoring_weights_simple.metric_key IS 'Metric identifier (e.g., ytd_return, sharpe_ratio)';
COMMENT ON COLUMN scoring_weights_simple.weight IS 'Weight value for this metric in this asset class';

-- Sample data for testing (optional - remove for production)
-- INSERT INTO scoring_weights_simple (asset_class_id, metric_key, weight) VALUES
-- ((SELECT id FROM asset_classes WHERE name = 'Large Cap Growth' LIMIT 1), 'ytd_return', 0.20),
-- ((SELECT id FROM asset_classes WHERE name = 'Large Cap Growth' LIMIT 1), 'one_year_return', 0.30),
-- ((SELECT id FROM asset_classes WHERE name = 'Large Cap Growth' LIMIT 1), 'sharpe_ratio', 0.25);