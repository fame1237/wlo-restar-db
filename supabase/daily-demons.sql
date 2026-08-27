-- ปีศาจประจำวัน: รันไฟล์นี้ครั้งเดียวใน Supabase Dashboard > SQL Editor
-- เก็บข้อมูลแยกตามวันที่ประเทศไทย จึงเริ่มรายการใหม่อัตโนมัติเมื่อพ้นเที่ยงคืน

begin;

-- ทำให้ migration นี้รันเดี่ยวได้ แม้โปรเจกต์เดิมยังไม่มีฟังก์ชันตรวจผู้ดูแล
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

create or replace function public.normalize_demon_name(input_name text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select btrim(regexp_replace(btrim(input_name), '^ปีศาจ[[:space:]]*', '', ''));
$$;

-- ทำให้ชื่อเดิมที่ขึ้นต้นด้วย "ปีศาจ" ใช้มาตรฐานเดียวกัน โดยไม่แตะชื่อที่สั้นผิดเงื่อนไข
update public.demons
set name = public.normalize_demon_name(name)
where name <> public.normalize_demon_name(name)
  and char_length(public.normalize_demon_name(name)) between 2 and 80;

-- ป้องกันชื่อซ้ำหลังตัดคำนำหน้า เช่น "ปีศาจทานตะวัน" กับ "ทานตะวัน"
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

-- รองรับโปรเจกต์ที่เคยรัน migration เวอร์ชันก่อนหน้าแล้ว
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
on public.daily_demons
for select
to anon, authenticated
using (true);

drop policy if exists "admin_can_create_daily_demons" on public.daily_demons;
create policy "admin_can_create_daily_demons"
on public.daily_demons
for insert
to authenticated
with check ((select public.is_demondex_admin()));

drop policy if exists "admin_can_update_daily_demons" on public.daily_demons;
create policy "admin_can_update_daily_demons"
on public.daily_demons
for update
to authenticated
using ((select public.is_demondex_admin()))
with check ((select public.is_demondex_admin()));

drop policy if exists "admin_can_delete_daily_demons" on public.daily_demons;
create policy "admin_can_delete_daily_demons"
on public.daily_demons
for delete
to authenticated
using ((select public.is_demondex_admin()));

commit;
