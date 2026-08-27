-- Run once in Supabase SQL Editor before deploying the UI that supports "ยังไม่รู้".
alter table public.demons
  drop constraint if exists demons_element_check;

alter table public.demons
  add constraint demons_element_check
  check (element in ('earth', 'water', 'wind', 'fire', 'unknown'));
