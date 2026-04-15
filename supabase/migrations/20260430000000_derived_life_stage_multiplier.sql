-- Derive life_stage_multiplier from cat age + breeding state instead of storing
-- it manually. The admin-entered `cats.life_stage_multiplier` column is dropped
-- in favour of `public.cat_derived_life_stage_multiplier(uuid)`, which inspects:
--   • the cat's age (from date_of_birth)
--   • whether the cat is currently nursing a litter (lactating window)
--   • whether the cat has an active pregnant/confirmed mating record
--
-- Multiplier table (spec §3.4.2):
--   • Kitten < 6 months         → 2.5
--   • Lactating (≤ 6 weeks pp)  → 2.0
--   • Pregnant                  → 1.6
--   • Kitten 6–12 months        → 2.0
--   • Adult (default)           → 1.4  (intact adult — breeding cattery default)

-- ─── Derived multiplier helper ───────────────────────────────────────────────
create or replace function public.cat_derived_life_stage_multiplier(p_cat_id uuid)
returns numeric
language sql
stable
as $$
  with months as (
    select
      c.id,
      (date_part('year',  age(current_date, c.date_of_birth)) * 12
     + date_part('month', age(current_date, c.date_of_birth)))::int as months_old
    from public.cats c
    where c.id = p_cat_id
  )
  select case
    -- Young kittens always win, regardless of breeding state.
    when m.months_old < 6 then 2.5::numeric

    -- Lactating: has a litter born within the last 6 weeks (42 days).
    when exists (
      select 1
      from public.litters l
      join public.mating_records mr on mr.id = l.mating_record_id
      where mr.female_cat_id = p_cat_id
        and l.birth_date >= current_date - interval '42 days'
    ) then 2.0::numeric

    -- Pregnant: has a mating record marked confirmed or pregnant.
    when exists (
      select 1
      from public.mating_records mr
      where mr.female_cat_id = p_cat_id
        and mr.status in ('confirmed', 'pregnant')
    ) then 1.6::numeric

    -- Older kitten (6–12 months).
    when m.months_old < 12 then 2.0::numeric

    -- Adult default.
    else 1.4::numeric
  end
  from months m;
$$;

grant execute on function public.cat_derived_life_stage_multiplier(uuid)
  to authenticated, service_role;

-- ─── recommended_daily_kcal now uses the derived multiplier ──────────────────
create or replace function public.recommended_daily_kcal(p_cat_id uuid)
returns numeric
language sql
stable
as $$
  select round(
    (70 * power(lw.weight_kg, 0.75)
       * public.cat_derived_life_stage_multiplier(c.id))::numeric,
    0
  )
  from public.cats c
  left join public.cat_latest_weight lw on lw.cat_id = c.id
  where c.id = p_cat_id and lw.weight_kg is not null;
$$;

-- ─── Drop the now-obsolete stored column ─────────────────────────────────────
alter table public.cats drop column if exists life_stage_multiplier;
