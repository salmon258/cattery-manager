-- Fix sitter-reported "edit a meal, see the entry duplicated" bug.
--
-- The PATCH /api/eating-logs/[id] route ran three separate Supabase calls
-- back-to-back: UPDATE the parent eating_logs row, DELETE every child
-- eating_log_items row, then INSERT the new item set. Each call is its own
-- transaction. If a sitter double-tapped Save (mobile drawers don't always
-- propagate the disabled state before a second tap fires) two PATCH requests
-- could interleave on the server like:
--
--   R1: UPDATE …
--   R2: UPDATE …
--   R1: DELETE …
--   R2: DELETE …    -- nothing left to delete, succeeds with 0 rows
--   R1: INSERT [a]
--   R2: INSERT [a]  -- meal now has two copies of every item
--
-- Run the whole edit inside a single PL/pgSQL function so it executes as one
-- transaction. Anything between the DELETE and the INSERT now either lands
-- entirely or rolls back; concurrent edits serialize on the parent row's
-- update lock instead of racing.
--
-- The function is SECURITY INVOKER so the existing RLS policies keep
-- enforcing who is allowed to edit which meal — the route also keeps its
-- explicit ownership check as defense in depth. Food validity is still
-- checked in the route before we get here, so the function trusts that
-- every food_item_id resolves and is active.

create or replace function public.update_eating_log(
  p_log_id uuid,
  p_feeding_method feeding_method,
  p_notes text,
  p_items jsonb
) returns void
language plpgsql
set search_path = public
as $$
declare
  v_item jsonb;
  v_kcal numeric(5,2);
  v_food_id uuid;
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

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_food_id := (v_item->>'food_item_id')::uuid;
    select calories_per_gram into v_kcal
      from public.food_items
     where id = v_food_id;
    if v_kcal is null then
      raise exception 'Unknown food item: %', v_food_id using errcode = '23503';
    end if;

    insert into public.eating_log_items (
      eating_log_id, food_item_id,
      quantity_given_g, quantity_eaten,
      calories_per_gram_snapshot
    ) values (
      p_log_id,
      v_food_id,
      (v_item->>'quantity_given_g')::numeric,
      (v_item->>'quantity_eaten')::eaten_ratio,
      v_kcal
    );
  end loop;
end;
$$;
