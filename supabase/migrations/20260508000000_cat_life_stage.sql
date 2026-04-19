-- Expose the active life-stage name alongside the existing derived multiplier
-- so clients can render a single badge like "Pregnant · ×1.6".
--
-- Returns one of:
--   kitten_young  (< 6 months)   → 2.5
--   lactating     (≤ 42 days pp) → 2.0
--   pregnant                     → 1.6
--   kitten        (6–12 months)  → 2.0
--   spayed        (adult spayed) → 1.2
--   adult         (intact adult) → 1.4
create or replace function public.cat_life_stage(p_cat_id uuid)
returns text
language sql
stable
as $$
  with cat as (
    select
      c.id,
      c.is_spayed,
      (date_part('year',  age(current_date, c.date_of_birth)) * 12
     + date_part('month', age(current_date, c.date_of_birth)))::int as months_old
    from public.cats c
    where c.id = p_cat_id
  )
  select case
    when cat.months_old < 6 then 'kitten_young'
    when exists (
      select 1
      from public.litters l
      join public.mating_records mr on mr.id = l.mating_record_id
      where mr.female_cat_id = p_cat_id
        and l.birth_date >= current_date - interval '42 days'
    ) then 'lactating'
    when exists (
      select 1
      from public.mating_records mr
      where mr.female_cat_id = p_cat_id
        and mr.status in ('confirmed', 'pregnant')
    ) then 'pregnant'
    when cat.months_old < 12 then 'kitten'
    when cat.is_spayed then 'spayed'
    else 'adult'
  end
  from cat;
$$;

grant execute on function public.cat_life_stage(uuid)
  to authenticated, service_role;
