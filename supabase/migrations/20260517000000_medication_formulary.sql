-- Phase 14b: Medication Formulary (sickness → medication notes)
--
-- Lets admins build a per-cattery medication knowledge base. Pick a sickness
-- + a cat, and the app suggests recommended meds with weight-based doses.
--
-- Why three tables:
--   * `sicknesses`            — the conditions catalog
--   * `medication_templates`  — the medicine catalog with form/concentration
--   * `sickness_medications`  — the join with per-pairing dosing rules
--
-- Why we cannot blindly convert mg → ml: only liquids/injections expose a
-- mg-per-ml concentration. Tablets/capsules expose mg-per-unit and the app
-- has to round; topicals don't expose any concentration at all and are
-- displayed as raw mg with a note. The `form` enum + `per_unit` text drives
-- the per-form rendering in the UI.

-- ─── Enums ──────────────────────────────────────────────────────────────────
create type public.medication_form as enum (
  'tablet',
  'capsule',
  'liquid',     -- mg/ml — exact ml volume
  'injection',  -- mg/ml — exact ml volume
  'drops',      -- mg/drop — count drops
  'powder',     -- mg/sachet
  'topical',    -- raw dose only; not weight-precise
  'other'
);

-- ─── Sicknesses (conditions catalog) ────────────────────────────────────────
create table public.sicknesses (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sicknesses_active_idx on public.sicknesses(is_active);

create trigger sicknesses_set_updated_at
  before update on public.sicknesses
  for each row execute function public.set_updated_at();

-- ─── Medication templates (formulary) ───────────────────────────────────────
-- `concentration_amount` is how many `dose_unit` are in one administration
-- unit (per_unit). Examples:
--   * Amoxicillin oral suspension 50 mg/ml: form='liquid', concentration=50,
--     dose_unit='mg', per_unit='ml'
--   * Doxycycline 100 mg tablet: form='tablet', concentration=100,
--     dose_unit='mg', per_unit='tablet'
--   * Topical cream "as directed": form='topical', concentration=null,
--     dose_unit='mg', per_unit='application'
create table public.medication_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,                       -- e.g. "Amoxicillin"
  brand text,                               -- e.g. "Clavamox"
  form public.medication_form not null default 'tablet',
  concentration_amount numeric(10,4),       -- nullable for topicals/non-precise
  dose_unit text not null default 'mg',     -- "mg", "ml", "IU", "mcg", …
  per_unit text not null default 'tablet',  -- "tablet", "ml", "capsule", "drop", "sachet", "application"
  default_route public.med_route not null default 'oral',
  -- Some forms are not safely splittable (capsules, injections). The UI uses
  -- this to round suggestions: 1 = whole units only, 2 = halves OK, 4 = quarters OK.
  splittable_into int not null default 1 check (splittable_into in (1, 2, 4)),
  notes text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index medication_templates_active_idx on public.medication_templates(is_active);
create index medication_templates_name_idx on public.medication_templates(name);

create trigger medication_templates_set_updated_at
  before update on public.medication_templates
  for each row execute function public.set_updated_at();

-- ─── Sickness ↔ medication recommendations ──────────────────────────────────
-- Each row is one recommended medication for a sickness, with the dose rule.
-- Either `dose_per_kg` (weight-based) or `flat_dose` is set; the API rejects
-- having both null. `min_dose`/`max_dose` clamp the per-kg result.
create table public.sickness_medications (
  id uuid primary key default gen_random_uuid(),
  sickness_id uuid not null references public.sicknesses(id) on delete cascade,
  medication_template_id uuid not null references public.medication_templates(id) on delete restrict,
  dose_per_kg numeric(10,4),                -- in `dose_unit`
  flat_dose   numeric(10,4),                -- in `dose_unit` (overrides per-kg if set)
  min_dose    numeric(10,4),                -- clamp lower bound
  max_dose    numeric(10,4),                -- clamp upper bound
  frequency   text,                         -- "BID", "every 12h", "once daily", …
  duration_days int,                        -- typical course length
  priority    int not null default 1,       -- 1 = first-line, 2 = alternative, …
  notes       text,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- A given medicine appears at most once per sickness.
  unique (sickness_id, medication_template_id),
  -- At least one of the dose modes must be filled.
  check (dose_per_kg is not null or flat_dose is not null),
  check (min_dose is null or max_dose is null or min_dose <= max_dose)
);

create index sickness_medications_sickness_idx on public.sickness_medications(sickness_id, priority);
create index sickness_medications_template_idx on public.sickness_medications(medication_template_id);

create trigger sickness_medications_set_updated_at
  before update on public.sickness_medications
  for each row execute function public.set_updated_at();

-- ─── RLS ────────────────────────────────────────────────────────────────────
-- Read: any active user (sitters can see suggestions while looking at a cat).
-- Write: admin only — the formulary is curated.
alter table public.sicknesses             enable row level security;
alter table public.medication_templates   enable row level security;
alter table public.sickness_medications   enable row level security;

create policy sicknesses_select on public.sicknesses for select
  using (public.is_active_user());
create policy sicknesses_admin_all on public.sicknesses for all
  using (public.is_admin()) with check (public.is_admin());

create policy medication_templates_select on public.medication_templates for select
  using (public.is_active_user());
create policy medication_templates_admin_all on public.medication_templates for all
  using (public.is_admin()) with check (public.is_admin());

create policy sickness_medications_select on public.sickness_medications for select
  using (public.is_active_user());
create policy sickness_medications_admin_all on public.sickness_medications for all
  using (public.is_admin()) with check (public.is_admin());
