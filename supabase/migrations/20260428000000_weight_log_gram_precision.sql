-- Sitters log weight in grams (e.g. 4523 g → 4.523 kg), but weight_logs.weight_kg
-- was declared numeric(5,2), which silently rounded the gram digit away so the
-- UI's 3-decimal display always showed a trailing zero. Widen the column to
-- numeric(6,3) so the precision the form already collects is actually stored.
--
-- The cat_latest_weight view references weight_kg, so it must be dropped and
-- recreated around the ALTER TYPE. The view definition is otherwise unchanged
-- from 20260416000000_phase4_daily_care.sql.

drop view if exists public.cat_latest_weight;

alter table public.weight_logs
  alter column weight_kg type numeric(6,3);

create or replace view public.cat_latest_weight as
select distinct on (cat_id)
  cat_id,
  id as weight_log_id,
  weight_kg,
  recorded_at
from public.weight_logs
order by cat_id, recorded_at desc;

grant select on public.cat_latest_weight to authenticated, anon;
