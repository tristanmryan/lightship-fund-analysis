-- Funds as-of RPC and helper view
-- Provides funds joined with latest performance on or before a given date.

-- Helper view: latest performance per fund at or before date is parameterized in RPC,
-- so we implement as RPC only to keep planner efficient across drivers.

create or replace function public.get_funds_as_of(p_date date)
returns table (
  ticker text,
  name text,
  asset_class text,
  asset_class_id uuid,
  is_recommended boolean,
  ytd_return numeric,
  one_year_return numeric,
  three_year_return numeric,
  five_year_return numeric,
  ten_year_return numeric,
  sharpe_ratio numeric,
  standard_deviation numeric,
  standard_deviation_3y numeric,
  standard_deviation_5y numeric,
  expense_ratio numeric,
  alpha numeric,
  beta numeric,
  manager_tenure numeric,
  up_capture_ratio numeric,
  down_capture_ratio numeric,
  category_rank numeric,
  sec_yield numeric,
  fund_family text,
  perf_date date
)
language sql
stable
as $$
  with latest as (
    select fp.*,
           row_number() over (partition by fp.fund_ticker order by fp.date desc) as rn
    from public.fund_performance fp
    where fp.date <= coalesce(p_date, (select max(date) from public.fund_performance))
  )
  select f.ticker,
         f.name,
         f.asset_class,
         f.asset_class_id,
         coalesce(f.is_recommended, false) as is_recommended,
         l.ytd_return,
         l.one_year_return,
         l.three_year_return,
         l.five_year_return,
         l.ten_year_return,
         l.sharpe_ratio,
         l.standard_deviation,
         l.standard_deviation_3y,
         l.standard_deviation_5y,
         l.expense_ratio,
         l.alpha,
         l.beta,
         l.manager_tenure,
         l.up_capture_ratio,
         l.down_capture_ratio,
         l.category_rank,
         l.sec_yield,
         l.fund_family,
         l.date as perf_date
  from public.funds f
  left join latest l on l.fund_ticker = f.ticker and l.rn = 1
  order by f.ticker asc;
$$;

grant execute on function public.get_funds_as_of(date) to anon, authenticated, service_role;
