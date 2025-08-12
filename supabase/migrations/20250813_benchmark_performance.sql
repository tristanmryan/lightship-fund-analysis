-- Idempotent creation of benchmark_performance table mirroring fund_performance
create extension if not exists "uuid-ossp";

create table if not exists public.benchmark_performance (
  id uuid primary key default uuid_generate_v4(),
  benchmark_ticker text not null,
  date date not null,
  ytd_return numeric(10,4),
  one_year_return numeric(10,4),
  three_year_return numeric(10,4),
  five_year_return numeric(10,4),
  ten_year_return numeric(10,4),
  sharpe_ratio numeric(10,4),
  standard_deviation numeric(10,4),
  standard_deviation_3y numeric(10,4),
  standard_deviation_5y numeric(10,4),
  expense_ratio numeric(10,4),
  alpha numeric(10,4),
  beta numeric(10,4),
  manager_tenure numeric(5,2),
  up_capture_ratio numeric(10,4),
  down_capture_ratio numeric(10,4),
  created_at timestamptz not null default now(),
  unique(benchmark_ticker, date)
);

create index if not exists idx_benchmark_performance_ticker_date on public.benchmark_performance(benchmark_ticker, date);
create index if not exists idx_benchmark_performance_date on public.benchmark_performance(date);

-- RLS alignment with other tables (enable and basic policies mirroring fund_performance)
alter table public.benchmark_performance enable row level security;
do $$ begin
  perform 1;
  exception when others then null;
end $$;

-- Select for authenticated users (if roles exist in environment)
-- These policies can be refined when Auth is fully wired
drop policy if exists "Authenticated users can view benchmark performance" on public.benchmark_performance;
create policy "Authenticated users can view benchmark performance" on public.benchmark_performance
  for select using (true);

drop policy if exists "Admins can manage benchmark performance" on public.benchmark_performance;
create policy "Admins can manage benchmark performance" on public.benchmark_performance
  for all using (true) with check (true);

