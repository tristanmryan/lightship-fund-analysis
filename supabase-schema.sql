-- Supabase Database Schema for Lightship Fund Analysis
-- Run this in your Supabase SQL editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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
    ip_address INET,
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
    standard_deviation DECIMAL(10,4), -- deprecated; prefer horizon-specific fields
    standard_deviation_3y DECIMAL(10,4),
    standard_deviation_5y DECIMAL(10,4),
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
    ip_address INET,
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

-- Create indexes for better performance
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

-- Research notes table (append-only)
create table if not exists public.fund_research_notes (
  id uuid primary key default gen_random_uuid(),
  fund_id uuid null,
  fund_ticker text null,
  override_id uuid null references public.fund_overrides(id) on delete set null,
  body text not null,
  decision text null check (decision in ('approve','monitor','reject','hold')),
  created_by text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_notes_fund_created_at on public.fund_research_notes (fund_id, created_at desc);
create index if not exists idx_notes_override on public.fund_research_notes (override_id);

create or replace function public.forbid_update_delete()
returns trigger language plpgsql as $$
begin
  raise exception 'fund_research_notes is append-only';
end $$;

drop trigger if exists trg_notes_no_update on public.fund_research_notes;
create trigger trg_notes_no_update before update on public.fund_research_notes
for each row execute function public.forbid_update_delete();

drop trigger if exists trg_notes_no_delete on public.fund_research_notes;
create trigger trg_notes_no_delete before delete on public.fund_research_notes
for each row execute function public.forbid_update_delete();

-- RLS plan (deferred until Supabase Auth in UI)
-- alter table public.fund_research_notes enable row level security;
-- policies will use auth.uid(); implement in the Auth PR

-- Create RLS (Row Level Security) policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE fund_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE benchmarks ENABLE ROW LEVEL SECURITY;

-- Users policies (admin only for now)
CREATE POLICY "Users can view their own data" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can manage users" ON users
    FOR ALL USING (auth.uid() IN (SELECT id FROM users WHERE role = 'admin'));

-- Funds policies (read for all authenticated users, write for admins)
CREATE POLICY "Authenticated users can view funds" ON funds
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage funds" ON funds
    FOR ALL USING (auth.uid() IN (SELECT id FROM users WHERE role = 'admin'));

-- Fund performance policies
CREATE POLICY "Authenticated users can view fund performance" ON fund_performance
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage fund performance" ON fund_performance
    FOR ALL USING (auth.uid() IN (SELECT id FROM users WHERE role = 'admin'));

-- Activity logs policies (admin only)
CREATE POLICY "Admins can view activity logs" ON activity_logs
    FOR SELECT USING (auth.uid() IN (SELECT id FROM users WHERE role = 'admin'));

CREATE POLICY "System can insert activity logs" ON activity_logs
    FOR INSERT WITH CHECK (true);

-- Snapshots policies
CREATE POLICY "Authenticated users can view snapshots" ON snapshots
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage snapshots" ON snapshots
    FOR ALL USING (auth.uid() IN (SELECT id FROM users WHERE role = 'admin'));

-- Benchmarks policies
CREATE POLICY "Authenticated users can view benchmarks" ON benchmarks
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage benchmarks" ON benchmarks
    FOR ALL USING (auth.uid() IN (SELECT id FROM users WHERE role = 'admin'));

-- TODO: Enable RLS and replace anon policies with authenticated once Supabase Auth is in place (Phase 4).

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

-- RPC execution grants
grant execute on function public.list_snapshot_counts() to anon, authenticated;
grant execute on function public.list_snapshot_counts_detailed() to anon, authenticated;
grant execute on function public.list_trade_data_counts() to anon, authenticated;

-- List snapshot months with row counts (RPC)
create or replace function public.list_snapshot_counts()
returns table("date" date, rows bigint)
language sql
stable
as $$
  select fp.date as "date", count(*)::bigint as rows
  from public.fund_performance fp
  group by fp.date
  order by fp.date desc;
$$;

-- List snapshot months with both fund and benchmark counts (RPC)
create or replace function public.list_snapshot_counts_detailed()
returns table("date" date, fund_rows bigint, benchmark_rows bigint)
language sql
stable
as $$
  with fund_counts as (
    select fp.date, count(*)::bigint as fund_rows
    from public.fund_performance fp
    group by fp.date
  ),
  benchmark_counts as (
    select bp.date, count(*)::bigint as benchmark_rows
    from public.benchmark_performance bp
    group by bp.date
  ),
  all_dates as (
    select distinct date from fund_counts
    union
    select distinct date from benchmark_counts
  )
  select 
    ad.date as "date",
    coalesce(fc.fund_rows, 0) as fund_rows,
    coalesce(bc.benchmark_rows, 0) as benchmark_rows
  from all_dates ad
  left join fund_counts fc on ad.date = fc.date
  left join benchmark_counts bc on ad.date = bc.date
  order by ad.date desc;
$$;

-- List trade data months with row counts (RPC)
create or replace function public.list_trade_data_counts()
returns table("month" date, trade_rows bigint)
language sql
stable
as $$
  select 
    date_trunc('month', trade_date)::date as "month",
    count(*)::bigint as trade_rows
  from public.trade_activity
  group by date_trunc('month', trade_date)
  order by date_trunc('month', trade_date) desc;
$$;

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