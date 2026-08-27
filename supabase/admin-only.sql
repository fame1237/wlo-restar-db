-- DemonDex: จำกัดการเขียนข้อมูลให้บัญชีผู้ดูแลเพียงบัญชีเดียว
-- รันไฟล์นี้หลังสร้างผู้ใช้ admin1234@demondex.local ใน Authentication > Users

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
