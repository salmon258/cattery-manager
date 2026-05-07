-- Store exact eaten grams instead of bucketing through the ratio enum.
--
-- Sitters reported entering given=30 / eaten=9 on a meal log and seeing
-- the eaten value snap back to 6 after save. The DB only stored
-- `quantity_eaten` (an `eaten_ratio` enum: all/most/half/little/none),
-- so the form rounded 9/30 = 0.3 to the nearest bucket — `little`,
-- factor 0.2 — and the eating card later reconstructed eaten as
-- given × 0.2 = 6. The ratio enum is too coarse to round-trip.
--
-- Add an explicit `quantity_eaten_g numeric(7,2)` column. New writes
-- store the actual grams the cat ate. The kcal generated column reads
-- from this instead of the bucketed enum, so reports stay accurate to
-- the gram. The enum stays around (sitters still see "100% / ~75% /
-- ~50%" badges and reports filter by it) but is now derived from the
-- precise number rather than the source of truth.

alter table public.eating_log_items
  add column quantity_eaten_g numeric(7,2);

-- Backfill from the bucketed ratio. This is the same factor the UI used
-- to reconstruct eaten grams, so historical rows display the same value
-- they did before the column existed.
update public.eating_log_items
   set quantity_eaten_g = quantity_given_g * case quantity_eaten
     when 'all'    then 1.0
     when 'most'   then 0.75
     when 'half'   then 0.5
     when 'little' then 0.2
     when 'none'   then 0.0
   end;

alter table public.eating_log_items
  alter column quantity_eaten_g set not null;

alter table public.eating_log_items
  add constraint eating_log_items_eaten_g_chk
    check (quantity_eaten_g >= 0 and quantity_eaten_g <= quantity_given_g);

-- Replace the generated kcal column so it uses precise grams. Stored
-- generated columns can't be altered in place — drop and re-add.
alter table public.eating_log_items
  drop column estimated_kcal_consumed;

alter table public.eating_log_items
  add column estimated_kcal_consumed numeric(8,2) generated always as (
    quantity_eaten_g * calories_per_gram_snapshot
  ) stored;

-- Update the atomic edit function to write the new column. Replaces the
-- 20260519 version which only knew about the enum.
create or replace function public.update_eating_log(
  p_log_id uuid,
  p_feeding_method feeding_method,
  p_notes text,
  p_items jsonb
) returns void
language plpgsql
set search_path = public
as $$
begin
  update public.eating_logs
     set feeding_method = p_feeding_method,
         notes = p_notes
   where id = p_log_id;

  if not found then
    raise exception 'Eating log % not found or not editable', p_log_id
      using errcode = '42501';
  end if;

  delete from public.eating_log_items where eating_log_id = p_log_id;

  insert into public.eating_log_items (
    eating_log_id,
    food_item_id,
    quantity_given_g,
    quantity_eaten,
    quantity_eaten_g,
    calories_per_gram_snapshot
  )
  select
    p_log_id,
    i.food_item_id,
    i.quantity_given_g,
    i.quantity_eaten,
    i.quantity_eaten_g,
    fi.calories_per_gram
  from jsonb_to_recordset(p_items) as i(
    food_item_id uuid,
    quantity_given_g numeric,
    quantity_eaten eaten_ratio,
    quantity_eaten_g numeric
  )
  join public.food_items fi on fi.id = i.food_item_id;
end;
$$;
