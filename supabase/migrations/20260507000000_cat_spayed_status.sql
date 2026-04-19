-- Adds `cats.is_spayed` and folds it into the derived life-stage multiplier.
--
-- Spayed/neutered adult cats have lower maintenance energy needs than intact
-- breeding cats. We use a 1.2 factor for spayed adults (vs. 1.4 intact) and
-- 1.0 for spayed retired cats (vs. 1.4 default for adults). Kittens, pregnant,
-- and lactating states are left untouched since a spayed cat cannot be in
-- those states.

alter table public.cats
  add column if not exists is_spayed boolean not null default false;

create or replace function public.cat_derived_life_stage_multiplier(p_cat_id uuid)
returns numeric
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
    -- Young kittens always win, regardless of breeding state.
    when cat.months_old < 6 then 2.5::numeric

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
    when cat.months_old < 12 then 2.0::numeric

    -- Adult default, reduced when spayed/neutered.
    else case when cat.is_spayed then 1.2::numeric else 1.4::numeric end
  end
  from cat;
$$;

grant execute on function public.cat_derived_life_stage_multiplier(uuid)
  to authenticated, service_role;
