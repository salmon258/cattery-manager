-- Rewrite update_eating_log to use jsonb_to_recordset + INSERT…SELECT.
--
-- Sitters reported that after the 20260518 atomic-update migration, edits to
-- eating log items wouldn't stick — typing 9 in a meal that already showed 6
-- would still show 6 after save. The duplicate-on-update bug fixed in
-- 20260518 is gone, but the value the user typed never lands in the DB.
--
-- The previous body looped over jsonb_array_elements and pulled each field
-- out by hand:
--
--   (v_item->>'quantity_given_g')::numeric
--
-- That worked in isolation but is brittle: ->> always returns text, the cast
-- is unconstrained, and any field-name typo / type mismatch fails silently
-- (the cast yields NULL or the wrong field is read) instead of erroring out.
-- Replace the whole loop with a single INSERT…SELECT that pulls the items
-- through jsonb_to_recordset with an explicit column list. PostgreSQL now
-- strictly types each field at extraction time, so a JSON whose
-- `quantity_given_g` is 9 lands as 9 — no manual casting in the middle.
-- Joining to food_items in the same SELECT also drops the per-row lookup +
-- raise-exception dance and lets a missing/inactive food fall out as a
-- foreign-key violation, which RLS already surfaces.

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
    calories_per_gram_snapshot
  )
  select
    p_log_id,
    i.food_item_id,
    i.quantity_given_g,
    i.quantity_eaten,
    fi.calories_per_gram
  from jsonb_to_recordset(p_items) as i(
    food_item_id uuid,
    quantity_given_g numeric,
    quantity_eaten eaten_ratio
  )
  join public.food_items fi on fi.id = i.food_item_id;
end;
$$;
