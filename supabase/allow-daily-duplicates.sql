-- อนุญาตให้ปีศาจตัวเดียวกันอยู่ในรายชื่อประจำวันได้มากกว่าหนึ่งช่อง
-- ยังคงจำกัดให้แต่ละวันมีได้เพียงหนึ่งรายการต่อหนึ่ง slot
alter table public.daily_demons
  drop constraint if exists daily_demons_active_date_demon_id_key;
