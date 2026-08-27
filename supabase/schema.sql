-- DemonDex database schema
-- รันไฟล์นี้ใน Supabase Dashboard > SQL Editor หนึ่งครั้ง

create extension if not exists pgcrypto;

create table if not exists public.demons (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  element text not null check (element in ('earth', 'water', 'wind', 'fire', 'unknown')),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists demons_name_unique_ci
  on public.demons (lower(btrim(name)));

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists demons_set_updated_at on public.demons;
create trigger demons_set_updated_at
before update on public.demons
for each row execute function public.set_updated_at();

alter table public.demons enable row level security;

create or replace function public.is_demondex_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'admin1234@demondex.local';
$$;

revoke all on function public.is_demondex_admin() from public, anon;
grant execute on function public.is_demondex_admin() to authenticated;

revoke all on table public.demons from anon, authenticated;
grant select on table public.demons to anon, authenticated;
grant insert, update, delete on table public.demons to authenticated;

drop policy if exists "demons_are_publicly_readable" on public.demons;
create policy "demons_are_publicly_readable"
on public.demons
for select
to anon, authenticated
using (true);

drop policy if exists "members_can_create_demons" on public.demons;
create policy "members_can_create_demons"
on public.demons
for insert
to authenticated
with check ((select public.is_demondex_admin()));

drop policy if exists "members_can_update_demons" on public.demons;
create policy "members_can_update_demons"
on public.demons
for update
to authenticated
using ((select public.is_demondex_admin()))
with check ((select public.is_demondex_admin()));

drop policy if exists "members_can_delete_demons" on public.demons;
create policy "members_can_delete_demons"
on public.demons
for delete
to authenticated
using ((select public.is_demondex_admin()));

-- รายการปีศาจประจำวัน (สูงสุด 5 ตัวต่อวันตามเวลาไทย)
create or replace function public.normalize_demon_name(input_name text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select btrim(regexp_replace(btrim(input_name), '^ปีศาจ[[:space:]]*', '', ''));
$$;

create unique index if not exists demons_name_normalized_unique
  on public.demons (lower(public.normalize_demon_name(name)));

create table if not exists public.daily_demons (
  id uuid primary key default gen_random_uuid(),
  active_date date not null default ((now() at time zone 'Asia/Bangkok')::date),
  slot smallint not null check (slot between 1 and 5),
  demon_id uuid not null references public.demons (id) on delete cascade,
  is_new_demon boolean not null default false,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (active_date, slot)
);

alter table public.daily_demons
  add column if not exists is_new_demon boolean not null default false;

create index if not exists daily_demons_active_date_idx
  on public.daily_demons (active_date, slot);

alter table public.daily_demons enable row level security;

revoke all on table public.daily_demons from anon, authenticated;
grant select on table public.daily_demons to anon, authenticated;
grant insert, update, delete on table public.daily_demons to authenticated;

drop policy if exists "daily_demons_are_publicly_readable" on public.daily_demons;
create policy "daily_demons_are_publicly_readable"
on public.daily_demons for select to anon, authenticated using (true);

drop policy if exists "admin_can_create_daily_demons" on public.daily_demons;
create policy "admin_can_create_daily_demons"
on public.daily_demons for insert to authenticated
with check ((select public.is_demondex_admin()));

drop policy if exists "admin_can_update_daily_demons" on public.daily_demons;
create policy "admin_can_update_daily_demons"
on public.daily_demons for update to authenticated
using ((select public.is_demondex_admin()))
with check ((select public.is_demondex_admin()));

drop policy if exists "admin_can_delete_daily_demons" on public.daily_demons;
create policy "admin_can_delete_daily_demons"
on public.daily_demons for delete to authenticated
using ((select public.is_demondex_admin()));
