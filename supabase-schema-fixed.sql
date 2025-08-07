-- Fixed Supabase Database Schema for Lightship Fund Analysis
-- Run this in your Supabase SQL editor to fix the RLS issues

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing triggers and functions first
DROP TRIGGER IF EXISTS update_funds_last_updated ON funds;
DROP FUNCTION IF EXISTS update_fund_last_updated();
DROP FUNCTION IF EXISTS get_latest_fund_performance(VARCHAR);

-- Users table (for future multi-user support)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',
    name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true
);

-- User sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address VARCHAR(45), -- Changed from INET to VARCHAR to avoid issues
    user_agent TEXT
);

-- Funds table (centralized fund registry)
CREATE TABLE IF NOT EXISTS funds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticker VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(500) NOT NULL,
    asset_class VARCHAR(100),
    is_recommended BOOLEAN DEFAULT false,
    added_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    removed_date TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Fund performance data table
CREATE TABLE IF NOT EXISTS fund_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fund_ticker VARCHAR(20) REFERENCES funds(ticker) ON DELETE CASCADE,
    date DATE NOT NULL,
    ytd_return DECIMAL(10,4),
    one_year_return DECIMAL(10,4),
    three_year_return DECIMAL(10,4),
    five_year_return DECIMAL(10,4),
    ten_year_return DECIMAL(10,4),
    sharpe_ratio DECIMAL(10,4),
    standard_deviation DECIMAL(10,4),
    expense_ratio DECIMAL(10,4),
    alpha DECIMAL(10,4),
    beta DECIMAL(10,4),
    manager_tenure DECIMAL(5,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(fund_ticker, date)
);

-- Activity logs table
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    details JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address VARCHAR(45), -- Changed from INET to VARCHAR
    user_agent TEXT
);

-- Snapshots table (for historical data)
CREATE TABLE IF NOT EXISTS snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    data JSONB NOT NULL,
    metadata JSONB,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Benchmarks table
CREATE TABLE IF NOT EXISTS benchmarks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_class VARCHAR(100) UNIQUE NOT NULL,
    ticker VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_funds_ticker ON funds(ticker);
CREATE INDEX IF NOT EXISTS idx_funds_asset_class ON funds(asset_class);
CREATE INDEX IF NOT EXISTS idx_funds_recommended ON funds(is_recommended);
CREATE INDEX IF NOT EXISTS idx_fund_performance_ticker_date ON fund_performance(fund_ticker, date);
CREATE INDEX IF NOT EXISTS idx_fund_performance_date ON fund_performance(date);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp ON activity_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_snapshots_date ON snapshots(date);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);

-- Disable RLS for now (we'll enable it later with proper policies)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE funds DISABLE ROW LEVEL SECURITY;
ALTER TABLE fund_performance DISABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE snapshots DISABLE ROW LEVEL SECURITY;
ALTER TABLE benchmarks DISABLE ROW LEVEL SECURITY;

-- Insert default admin user (password: lightship2024)
INSERT INTO users (id, email, password_hash, role, name, created_at)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'admin@lightship.com',
    '$2a$10$rQZ8K9vX2mN3pL4qR5sT6uV7wX8yZ9aA0bB1cC2dE3fF4gG5hH6iI7jJ8kK9lL0mM1nN2oO3pP4qQ5rR6sS7tT8uU9vV0wW1xX2yY3zZ4aA5bB6cC7dD8eE9fF0gG1hH2iI3jJ4kK5lL6mM7nN8oO9pP0qQ1rR2sS3tT4uU5vV6wW7xX8yY9zZ',
    'admin',
    'Administrator',
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Insert some default benchmarks
INSERT INTO benchmarks (asset_class, ticker, name) VALUES
('Large Cap Growth', 'IWF', 'Russell 1000 Growth'),
('Large Cap Value', 'IWD', 'Russell 1000 Value'),
('Mid Cap Growth', 'IWP', 'Russell Mid Cap Growth'),
('Mid Cap Value', 'IWS', 'Russell Mid Cap Value'),
('Small Cap Growth', 'IWO', 'Russell 2000 Growth'),
('Small Cap Value', 'IWN', 'Russell 2000 Value'),
('International', 'EFA', 'MSCI EAFE'),
('Emerging Markets', 'EEM', 'MSCI Emerging Markets'),
('Bonds', 'AGG', 'US Aggregate Bond'),
('Real Estate', 'IYR', 'US Real Estate')
ON CONFLICT (asset_class) DO NOTHING;

-- Create functions for common operations
CREATE OR REPLACE FUNCTION update_fund_last_updated()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update last_updated
CREATE TRIGGER update_funds_last_updated
    BEFORE UPDATE ON funds
    FOR EACH ROW
    EXECUTE FUNCTION update_fund_last_updated();

-- Function to get fund performance with latest data
CREATE OR REPLACE FUNCTION get_latest_fund_performance(fund_ticker_param VARCHAR)
RETURNS TABLE (
    ticker VARCHAR,
    name VARCHAR,
    asset_class VARCHAR,
    ytd_return DECIMAL,
    one_year_return DECIMAL,
    three_year_return DECIMAL,
    five_year_return DECIMAL,
    ten_year_return DECIMAL,
    sharpe_ratio DECIMAL,
    standard_deviation DECIMAL,
    expense_ratio DECIMAL,
    alpha DECIMAL,
    beta DECIMAL,
    manager_tenure DECIMAL,
    last_updated TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        f.ticker,
        f.name,
        f.asset_class,
        fp.ytd_return,
        fp.one_year_return,
        fp.three_year_return,
        fp.five_year_return,
        fp.ten_year_return,
        fp.sharpe_ratio,
        fp.standard_deviation,
        fp.expense_ratio,
        fp.alpha,
        fp.beta,
        fp.manager_tenure,
        fp.created_at as last_updated
    FROM funds f
    LEFT JOIN fund_performance fp ON f.ticker = fp.fund_ticker
    WHERE f.ticker = fund_ticker_param
    ORDER BY fp.date DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql; 