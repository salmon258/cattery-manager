-- Medication schedules: allow indefinite end date
--
-- Problem: medications.end_date was NOT NULL, forcing admins to pick an
-- explicit last day even for ongoing (lifelong / stop-when-needed) treatments.
--
-- Fix:
--   1. Drop the NOT NULL constraint on medications.end_date.
--   2. Rewrite regenerate_medication_tasks() so that when end_date is NULL the
--      trigger still generates a bounded rolling window of tasks (we use 180
--      days) instead of looping forever. When the window is about to run out
--      admins can re-trigger regeneration by touching the row (the existing
--      cron / on-read path, or just by editing and saving).
--   3. Re-fire the trigger for every existing active row so future tasks are
--      rebuilt consistently with the new logic.

-- ─── 1. Drop NOT NULL ────────────────────────────────────────────────────────
alter table public.medications
  alter column end_date drop not null;

-- ─── 2. Update the regeneration trigger to tolerate NULL end_date ───────────
create or replace function public.regenerate_medication_tasks()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_day         date;
  v_slot        text;
  v_due         timestamptz;
  v_now         timestamptz := now();
  v_tz          text;
  v_end         date;
  v_window_days int := 180;  -- rolling horizon when end_date is NULL
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

  -- Determine the effective end date. A NULL end_date means "indefinite, stop
  -- manually" — we still need a concrete bound so this loop terminates, so
  -- we pick a rolling window from today.
  if new.end_date is null then
    v_end := greatest(new.start_date, current_date) + v_window_days;
  else
    v_end := new.end_date;
  end if;

  v_day := greatest(new.start_date, current_date);
  while v_day <= v_end loop
    -- Respect interval_days: only generate on day (day - start_date) % interval == 0
    if ((v_day - new.start_date) % new.interval_days) = 0 then
      foreach v_slot in array new.time_slots loop
        -- Interpret the wall-clock `day + slot` as a naive timestamp in the
        -- cattery's local timezone, then convert to UTC for storage.
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

-- ─── 3. Re-fire the trigger for existing active rows ───────────────────────
-- `SET x = x` still counts as an update in Postgres, so the update trigger
-- rebuilds the future task list with the new logic. We only touch rows whose
-- schedule is still relevant (indefinite, or whose end_date is in the future).
update public.medications
   set time_slots = time_slots
 where is_active = true
   and (end_date is null or end_date >= current_date);
