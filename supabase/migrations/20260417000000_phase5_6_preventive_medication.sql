-- Phase 5 + 6: Preventive Health + Medication
-- - Vaccinations (§3.6) + Preventive (deworming/flea) treatments (§3.7)
-- - Scheduled medications with auto-generated daily tasks (§3.5.2)
-- - Ad hoc medicine/vitamin log (§3.5.1)

-- ============================================================================
-- Vaccinations
-- ============================================================================
create type vaccine_type as enum ('f3', 'f4', 'tricat', 'felv', 'rabies', 'other');

create table public.vaccinations (
  id uuid primary key default gen_random_uuid(),
  cat_id uuid not null references public.cats(id) on delete cascade,
  vaccine_type vaccine_type not null,
  vaccine_name text,                    -- Free text when `vaccine_type = 'other'`.
  administered_date date not null,
  batch_number text,
  administered_by_vet text,
  next_due_date date,                   -- Client computes default; admin can edit.
  notes text,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index vaccinations_cat_idx on public.vaccinations(cat_id, administered_date desc);
create index vaccinations_next_due_idx on public.vaccinations(next_due_date) where next_due_date is not null;

create trigger vaccinations_set_updated_at
  before update on public.vaccinations
  for each row execute function public.set_updated_at();

-- ============================================================================
-- Preventive treatments (deworming / flea / combined)
-- ============================================================================
create type preventive_treatment_type as enum ('deworming', 'flea', 'combined');

create table public.preventive_treatments (
  id uuid primary key default gen_random_uuid(),
  cat_id uuid not null references public.cats(id) on delete cascade,
  treatment_type preventive_treatment_type not null,
  product_name text not null,
  administered_date date not null,
  next_due_date date,
  notes text,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index preventive_cat_idx on public.preventive_treatments(cat_id, administered_date desc);
create index preventive_next_due_idx on public.preventive_treatments(next_due_date) where next_due_date is not null;

create trigger preventive_set_updated_at
  before update on public.preventive_treatments
  for each row execute function public.set_updated_at();

-- ============================================================================
-- Scheduled medications
-- ============================================================================
create type med_route as enum ('oral', 'topical', 'injection', 'other');

create table public.medications (
  id uuid primary key default gen_random_uuid(),
  cat_id uuid not null references public.cats(id) on delete cascade,
  medicine_name text not null,
  dose text not null,                   -- Free text (e.g. "5 mg", "0.5 ml").
  route med_route not null default 'oral',
  start_date date not null,
  end_date date not null,
  -- Every N days (1 = every day, 2 = every other day, 7 = weekly on start_date anniversary).
  interval_days int not null default 1 check (interval_days between 1 and 365),
  -- Time-of-day slots, e.g. {'08:00','20:00'} for 2x/day. At least one slot.
  time_slots text[] not null check (array_length(time_slots, 1) >= 1),
  notes text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index medications_cat_idx on public.medications(cat_id, is_active, start_date);

create trigger medications_set_updated_at
  before update on public.medications
  for each row execute function public.set_updated_at();

-- ============================================================================
-- Medication tasks (auto-generated from schedules)
-- ============================================================================
create table public.medication_tasks (
  id uuid primary key default gen_random_uuid(),
  medication_id uuid not null references public.medications(id) on delete cascade,
  cat_id uuid not null references public.cats(id) on delete cascade,
  due_at timestamptz not null,
  confirmed_at timestamptz,
  confirmed_by uuid references public.profiles(id) on delete set null,
  skipped boolean not null default false,
  skip_reason text,
  created_at timestamptz not null default now()
);

-- Prevents duplicate regeneration from the trigger creating the same task twice.
create unique index medication_tasks_unique_slot_idx
  on public.medication_tasks(medication_id, due_at);

create index medication_tasks_due_idx on public.medication_tasks(due_at) where confirmed_at is null and not skipped;
create index medication_tasks_cat_due_idx on public.medication_tasks(cat_id, due_at);

-- Regenerate future, unconfirmed tasks whenever a schedule is created or its
-- timing-related fields change. Past + confirmed tasks are preserved.
create or replace function public.regenerate_medication_tasks()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_day date;
  v_slot text;
  v_due timestamptz;
  v_now timestamptz := now();
begin
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
        v_due := (v_day::text || ' ' || v_slot)::timestamptz;
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

create trigger medications_regen_tasks_insert
  after insert on public.medications
  for each row execute function public.regenerate_medication_tasks();

create trigger medications_regen_tasks_update
  after update of start_date, end_date, interval_days, time_slots, is_active on public.medications
  for each row execute function public.regenerate_medication_tasks();

-- ============================================================================
-- Ad hoc medicine / vitamin log (§3.5.1)
-- ============================================================================
create table public.ad_hoc_medicines (
  id uuid primary key default gen_random_uuid(),
  cat_id uuid not null references public.cats(id) on delete cascade,
  medicine_name text not null,
  dose text,
  unit text,
  route med_route not null default 'oral',
  given_at timestamptz not null default now(),
  notes text,
  submitted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index ad_hoc_medicines_cat_idx on public.ad_hoc_medicines(cat_id, given_at desc);

-- ============================================================================
-- RLS
-- Spec §8.1: any active Cat Sitter can submit reports for any cat.
-- Vaccinations / preventives / ad-hoc meds follow that pattern.
-- Scheduled medications are admin-only to create/edit; sitters can confirm
-- their tasks.
-- ============================================================================
alter table public.vaccinations enable row level security;
alter table public.preventive_treatments enable row level security;
alter table public.medications enable row level security;
alter table public.medication_tasks enable row level security;
alter table public.ad_hoc_medicines enable row level security;

-- vaccinations
create policy vaccinations_select on public.vaccinations for select
  using (public.is_active_user());
create policy vaccinations_insert on public.vaccinations for insert
  with check (public.is_active_user() and recorded_by = auth.uid());
create policy vaccinations_admin_update on public.vaccinations for update
  using (public.is_admin()) with check (public.is_admin());
create policy vaccinations_admin_delete on public.vaccinations for delete
  using (public.is_admin());

-- preventive_treatments
create policy preventive_select on public.preventive_treatments for select
  using (public.is_active_user());
create policy preventive_insert on public.preventive_treatments for insert
  with check (public.is_active_user() and recorded_by = auth.uid());
create policy preventive_admin_update on public.preventive_treatments for update
  using (public.is_admin()) with check (public.is_admin());
create policy preventive_admin_delete on public.preventive_treatments for delete
  using (public.is_admin());

-- medications (admin-managed schedules)
create policy medications_select on public.medications for select
  using (public.is_active_user());
create policy medications_admin_all on public.medications for all
  using (public.is_admin()) with check (public.is_admin());

-- medication_tasks: any active user reads + can confirm (via UPDATE limited by
-- the trigger-based INSERT path). Direct INSERT by users is denied — tasks
-- only exist via the schedule trigger.
create policy medication_tasks_select on public.medication_tasks for select
  using (public.is_active_user());
-- Only allow flipping confirmation or skip flags; admins may do more broadly.
create policy medication_tasks_update_confirm on public.medication_tasks for update
  using (public.is_active_user())
  with check (public.is_active_user());
create policy medication_tasks_admin_delete on public.medication_tasks for delete
  using (public.is_admin());

-- ad_hoc_medicines
create policy ad_hoc_medicines_select on public.ad_hoc_medicines for select
  using (public.is_active_user());
create policy ad_hoc_medicines_insert on public.ad_hoc_medicines for insert
  with check (public.is_active_user() and submitted_by = auth.uid());
create policy ad_hoc_medicines_admin_update on public.ad_hoc_medicines for update
  using (public.is_admin()) with check (public.is_admin());
create policy ad_hoc_medicines_admin_delete on public.ad_hoc_medicines for delete
  using (public.is_admin());
