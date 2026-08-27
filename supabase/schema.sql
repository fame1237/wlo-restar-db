-- DemonDex database schema
-- รันไฟล์นี้ใน Supabase Dashboard > SQL Editor หนึ่งครั้ง

create extension if not exists pgcrypto;

create table if not exists public.demons (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  element text not null check (element in ('earth', 'water', 'wind', 'fire')),
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

