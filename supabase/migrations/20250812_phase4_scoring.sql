-- Phase 4: Scoring UX and Governance (idempotent migration)

-- Guard: enable extensions required
create extension if not exists pgcrypto;

-- Profiles
create table if not exists public.scoring_profiles (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  description text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists one_default_scoring_profile
  on public.scoring_profiles ((true)) where is_default;

-- Weights
create table if not exists public.scoring_weights (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.scoring_profiles(id) on delete cascade,
  metric_key text not null,
  scope text not null check (scope in ('global','asset_class','fund')),
  scope_value text null,
  weight numeric not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  unique(profile_id, metric_key, scope, scope_value)
);

-- Audit
create table if not exists public.scoring_weights_audit (
  id bigserial primary key,
  changed_at timestamptz not null default now(),
  action text not null check (action in ('INSERT','UPDATE','DELETE')),
  old_record jsonb,
  new_record jsonb
);

create or replace function public.scoring_weights_audit_fn()
returns trigger language plpgsql as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.scoring_weights_audit(action, old_record, new_record)
    values ('INSERT', null, to_jsonb(new.*));
    return new;
  elsif (tg_op = 'UPDATE') then
    insert into public.scoring_weights_audit(action, old_record, new_record)
    values ('UPDATE', to_jsonb(old.*), to_jsonb(new.*));
    return new;
  elsif (tg_op = 'DELETE') then
    insert into public.scoring_weights_audit(action, old_record, new_record)
    values ('DELETE', to_jsonb(old.*), null);
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists scoring_weights_audit_trg on public.scoring_weights;
create trigger scoring_weights_audit_trg
after insert or update or delete on public.scoring_weights
for each row execute function public.scoring_weights_audit_fn();

-- Seed default profile and weights
insert into public.scoring_profiles(name, description, is_default)
select 'Default', 'Default scoring profile seeded by Phase 4', true
where not exists (
  select 1 from public.scoring_profiles where name = 'Default'
);

with ranked as (
  select id, name, is_default,
         row_number() over (order by case when name = 'Default' then 0 else 1 end, created_at) as rn
  from public.scoring_profiles
  where is_default = true
)
update public.scoring_profiles p
set is_default = case when r.id = p.id and r.rn = 1 then true else false end
from ranked r
where r.id = p.id;

with def as (
  select id as profile_id from public.scoring_profiles where name = 'Default' limit 1
), w(metric_key, weight) as (
  values
    ('ytd', 0.025),
    ('oneYear', 0.05),
    ('threeYear', 0.10),
    ('fiveYear', 0.15),
    ('tenYear', 0.10),
    ('sharpeRatio3Y', 0.10),
    ('stdDev3Y', -0.075),
    ('stdDev5Y', -0.125),
    ('upCapture3Y', 0.075),
    ('downCapture3Y', -0.10),
    ('alpha5Y', 0.05),
    ('expenseRatio', -0.025),
    ('managerTenure', 0.025)
)
insert into public.scoring_weights(profile_id, metric_key, scope, scope_value, weight, enabled)
select def.profile_id, w.metric_key, 'global', null, w.weight, true
from def, w
on conflict (profile_id, metric_key, scope, scope_value)
do update set weight = excluded.weight, enabled = true, updated_at = now();

