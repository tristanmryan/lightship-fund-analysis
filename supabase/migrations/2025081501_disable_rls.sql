-- Migration: Disable RLS globally for internal tool simplicity
-- This ensures consistent anonymous access across all tables
-- Rollback: Enable RLS and add appropriate policies when needed

-- Disable RLS on all existing tables consistently
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE funds DISABLE ROW LEVEL SECURITY;
ALTER TABLE fund_performance DISABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE snapshots DISABLE ROW LEVEL SECURITY;
ALTER TABLE benchmarks DISABLE ROW LEVEL SECURITY;
ALTER TABLE asset_classes DISABLE ROW LEVEL SECURITY;
ALTER TABLE asset_class_synonyms DISABLE ROW LEVEL SECURITY;
ALTER TABLE asset_class_benchmarks DISABLE ROW LEVEL SECURITY;
ALTER TABLE fund_overrides DISABLE ROW LEVEL SECURITY;
ALTER TABLE benchmark_history DISABLE ROW LEVEL SECURITY;

-- Disable RLS on research notes table if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fund_research_notes') THEN
        ALTER TABLE fund_research_notes DISABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Disable RLS on benchmark_performance table if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'benchmark_performance') THEN
        ALTER TABLE benchmark_performance DISABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Disable RLS on scoring tables if they exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scoring_profiles') THEN
        ALTER TABLE scoring_profiles DISABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scoring_weights') THEN
        ALTER TABLE scoring_weights DISABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Ensure anon role has SELECT grants on all tables
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;

-- Grant execute on all functions to anon
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon;

-- Drop any existing RLS policies that might interfere
DROP POLICY IF EXISTS "Users can view their own data" ON users;
DROP POLICY IF EXISTS "Admins can manage users" ON users;
DROP POLICY IF EXISTS "Authenticated users can view funds" ON funds;
DROP POLICY IF EXISTS "Admins can manage funds" ON funds;
DROP POLICY IF EXISTS "Authenticated users can view fund performance" ON fund_performance;
DROP POLICY IF EXISTS "Admins can manage fund performance" ON fund_performance;
DROP POLICY IF EXISTS "Admins can view activity logs" ON activity_logs;
DROP POLICY IF EXISTS "System can insert activity logs" ON activity_logs;
DROP POLICY IF EXISTS "Authenticated users can view snapshots" ON snapshots;
DROP POLICY IF EXISTS "Admins can manage snapshots" ON snapshots;
DROP POLICY IF EXISTS "Authenticated users can view benchmarks" ON benchmarks;
DROP POLICY IF EXISTS "Admins can manage benchmarks" ON benchmarks;

-- Rollback plan:
-- 1. Enable RLS on each table individually
-- 2. Recreate appropriate policies for each table
-- 3. Test access patterns
-- Example rollback for users table:
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Users can view their own data" ON users FOR SELECT USING (auth.uid() = id);
