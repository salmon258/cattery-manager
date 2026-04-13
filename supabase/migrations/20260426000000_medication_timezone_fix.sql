-- Medication schedule timezone fix
--
-- Problem: regenerate_medication_tasks cast `day + time_slot` to timestamptz
-- using the Postgres session timezone (UTC on Supabase), so a slot of "18:00"
-- entered by an admin in Asia/Jakarta (GMT+7) was stored as 18:00 UTC, which
-- sitters' browsers then rendered as 01:00 the next day.
--
-- Fix: store a cattery timezone in system_settings and have the trigger use
-- `AT TIME ZONE <tz>` when interpreting the slot.

-- ─── 1. Add cattery_timezone to system_settings ─────────────────────────────
alter table public.system_settings
  add column if not exists cattery_timezone text not null default 'Asia/Jakarta';

-- ─── 2. Rewrite the regeneration trigger function ───────────────────────────
create or replace function public.regenerate_medication_tasks()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_day date;
  v_slot text;
  v_due timestamptz;
  v_now timestamptz := now();
  v_tz  text;
begin
  -- Load cattery timezone from settings (falls back to Asia/Jakarta).
  select coalesce(cattery_timezone, 'Asia/Jakarta')
    into v_tz
    from public.system_settings
    where id = 1;
  if v_tz is null then
    v_tz := 'Asia/Jakarta';
  end if;

  -- Clear future, not-yet-confirmed tasks for this medication so the refresh
  -- reflects the new schedule. Past + confirmed history is untouched.
  delete from public.medication_tasks
   where medication_id = new.id
     and confirmed_at is null
     and not skipped
     and due_at >= v_now;

  -- Do not generate if the med is deactivated.
  if new.is_active = false then
    return new;
  end if;

  v_day := greatest(new.start_date, current_date);
  while v_day <= new.end_date loop
    -- Respect interval_days: only generate on day (day - start_date) % interval == 0
    if ((v_day - new.start_date) % new.interval_days) = 0 then
      foreach v_slot in array new.time_slots loop
        -- Interpret the wall-clock `day + slot` as a naive timestamp in the
        -- cattery's local timezone, then convert to UTC for storage. This is
        -- what `timestamp AT TIME ZONE <zone>` does in Postgres.
        v_due := (v_day::text || ' ' || v_slot)::timestamp at time zone v_tz;
        if v_due >= v_now then
          insert into public.medication_tasks (medication_id, cat_id, due_at)
          values (new.id, new.cat_id, v_due)
          on conflict (medication_id, due_at) do nothing;
        end if;
      end loop;
    end if;
    v_day := v_day + 1;
  end loop;

  return new;
end;
$$;

-- ─── 3. Re-fire the trigger for every existing active medication ────────────
-- The update trigger only fires when listed columns change; `SET x = x` still
-- counts as an update in Postgres, so this re-runs regenerate for each row
-- and rebuilds the future task list with the correct timezone conversion.
update public.medications
   set time_slots = time_slots
 where is_active = true
   and end_date >= current_date;
