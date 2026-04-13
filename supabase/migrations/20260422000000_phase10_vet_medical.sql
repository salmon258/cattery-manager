-- Phase 10 — Vet & Medical
-- Adds: clinics, doctors, vet_visits, vet_visit_medicines, lab_results
--       + lab-results storage bucket
--       + vet_referral event type + linked_vet_visit_id on health_ticket_events

-- ─── Enum types ──────────────────────────────────────────────────────────────
create type public.doctor_specialisation as enum (
  'general', 'dermatology', 'cardiology', 'oncology', 'dentistry', 'surgery', 'other'
);
create type public.vet_visit_type as enum (
  'routine_checkup', 'emergency', 'follow_up', 'vaccination', 'surgery', 'dental', 'other'
);
create type public.vet_visit_status as enum (
  'scheduled', 'in_progress', 'completed', 'cancelled'
);
create type public.lab_result_file_type as enum ('pdf', 'image');

-- ─── clinics ─────────────────────────────────────────────────────────────────
create table public.clinics (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  address    text,
  phone      text,
  email      text,
  website    text,
  notes      text,
  is_active  boolean     not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(name) between 1 and 200)
);

-- ─── doctors ─────────────────────────────────────────────────────────────────
create table public.doctors (
  id             uuid        primary key default gen_random_uuid(),
  full_name      text        not null,
  clinic_id      uuid
                   constraint doctors_clinic_fkey
                   references public.clinics(id) on delete set null,
  specialisation public.doctor_specialisation not null default 'general',
  phone          text,
  notes          text,
  is_active      boolean     not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (char_length(full_name) between 1 and 200)
);

-- ─── vet_visits ──────────────────────────────────────────────────────────────
create table public.vet_visits (
  id                  uuid        primary key default gen_random_uuid(),
  cat_id              uuid        not null
                        constraint vet_visits_cat_fkey
                        references public.cats(id) on delete cascade,
  clinic_id           uuid
                        constraint vet_visits_clinic_fkey
                        references public.clinics(id) on delete set null,
  doctor_id           uuid
                        constraint vet_visits_doctor_fkey
                        references public.doctors(id) on delete set null,
  health_ticket_id    uuid
                        constraint vet_visits_health_ticket_fkey
                        references public.health_tickets(id) on delete set null,
  visit_date          date        not null,
  visit_type          public.vet_visit_type   not null default 'routine_checkup',
  status              public.vet_visit_status not null default 'completed',
  chief_complaint     text,
  diagnosis           text,
  treatment_performed text,
  follow_up_date      date,
  visit_cost          numeric(12,2),
  transport_cost      numeric(12,2),
  notes               text,
  created_by          uuid
                        constraint vet_visits_created_by_fkey
                        references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (chief_complaint     is null or char_length(chief_complaint)     <= 1000),
  check (diagnosis           is null or char_length(diagnosis)           <= 5000),
  check (treatment_performed is null or char_length(treatment_performed) <= 5000),
  check (notes               is null or char_length(notes)               <= 5000),
  check (visit_cost          is null or visit_cost     >= 0),
  check (transport_cost      is null or transport_cost >= 0)
);

-- ─── vet_visit_medicines ─────────────────────────────────────────────────────
create table public.vet_visit_medicines (
  id            uuid        primary key default gen_random_uuid(),
  vet_visit_id  uuid        not null
                  constraint vet_visit_medicines_visit_fkey
                  references public.vet_visits(id) on delete cascade,
  medicine_name text        not null,
  dose          text,
  frequency     text,
  duration      text,
  notes         text,
  created_at    timestamptz not null default now(),
  check (char_length(medicine_name) between 1 and 200)
);

-- ─── lab_results ─────────────────────────────────────────────────────────────
create table public.lab_results (
  id              uuid        primary key default gen_random_uuid(),
  vet_visit_id    uuid        not null
                    constraint lab_results_visit_fkey
                    references public.vet_visits(id) on delete cascade,
  file_url        text        not null,
  storage_path    text        not null,
  file_type       public.lab_result_file_type not null,
  file_name       text        not null,
  file_size_bytes bigint,
  notes           text,
  uploaded_by     uuid
                    constraint lab_results_uploaded_by_fkey
                    references public.profiles(id) on delete set null,
  uploaded_at     timestamptz not null default now(),
  check (char_length(file_name) between 1 and 500),
  check (notes is null or char_length(notes) <= 1000)
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────
create index clinics_is_active_idx          on public.clinics(is_active) where is_active = true;
create index doctors_clinic_id_idx          on public.doctors(clinic_id);
create index doctors_is_active_idx          on public.doctors(is_active) where is_active = true;
create index vet_visits_cat_id_idx          on public.vet_visits(cat_id);
create index vet_visits_clinic_id_idx       on public.vet_visits(clinic_id);
create index vet_visits_doctor_id_idx       on public.vet_visits(doctor_id);
create index vet_visits_health_ticket_idx   on public.vet_visits(health_ticket_id);
create index vet_visits_visit_date_idx      on public.vet_visits(cat_id, visit_date desc);
create index vet_visit_medicines_visit_idx  on public.vet_visit_medicines(vet_visit_id);
create index lab_results_visit_idx          on public.lab_results(vet_visit_id);

-- ─── updated_at trigger ──────────────────────────────────────────────────────
create or replace function public.set_vet_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger clinics_updated_at    before update on public.clinics    for each row execute function public.set_vet_updated_at();
create trigger doctors_updated_at    before update on public.doctors    for each row execute function public.set_vet_updated_at();
create trigger vet_visits_updated_at before update on public.vet_visits for each row execute function public.set_vet_updated_at();

-- ─── Row-Level Security ──────────────────────────────────────────────────────
alter table public.clinics              enable row level security;
alter table public.doctors              enable row level security;
alter table public.vet_visits           enable row level security;
alter table public.vet_visit_medicines  enable row level security;
alter table public.lab_results          enable row level security;

-- clinics: all authenticated users read; admins write
create policy "clinics_select" on public.clinics
  for select to authenticated using (true);
create policy "clinics_insert" on public.clinics
  for insert to authenticated with check (public.is_admin());
create policy "clinics_update" on public.clinics
  for update to authenticated using (public.is_admin());
create policy "clinics_delete" on public.clinics
  for delete to authenticated using (public.is_admin());

-- doctors: same as clinics
create policy "doctors_select" on public.doctors
  for select to authenticated using (true);
create policy "doctors_insert" on public.doctors
  for insert to authenticated with check (public.is_admin());
create policy "doctors_update" on public.doctors
  for update to authenticated using (public.is_admin());
create policy "doctors_delete" on public.doctors
  for delete to authenticated using (public.is_admin());

-- vet_visits: all authenticated users read + insert; admins can update/delete
create policy "vet_visits_select" on public.vet_visits
  for select to authenticated using (true);
create policy "vet_visits_insert" on public.vet_visits
  for insert to authenticated with check (true);
create policy "vet_visits_update" on public.vet_visits
  for update to authenticated using (public.is_admin());
create policy "vet_visits_delete" on public.vet_visits
  for delete to authenticated using (public.is_admin());

-- vet_visit_medicines: follows parent visit
create policy "vet_visit_medicines_select" on public.vet_visit_medicines
  for select to authenticated using (true);
create policy "vet_visit_medicines_insert" on public.vet_visit_medicines
  for insert to authenticated with check (true);
create policy "vet_visit_medicines_update" on public.vet_visit_medicines
  for update to authenticated using (public.is_admin());
create policy "vet_visit_medicines_delete" on public.vet_visit_medicines
  for delete to authenticated using (public.is_admin());

-- lab_results: all authenticated users read/insert; only admin delete
create policy "lab_results_select" on public.lab_results
  for select to authenticated using (true);
create policy "lab_results_insert" on public.lab_results
  for insert to authenticated with check (true);
create policy "lab_results_delete" on public.lab_results
  for delete to authenticated using (public.is_admin());

-- ─── Storage bucket: lab-results ─────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('lab-results', 'lab-results', true);

create policy "lab_results_storage_select"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'lab-results');

create policy "lab_results_storage_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'lab-results');

create policy "lab_results_storage_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'lab-results' and public.is_admin());

-- ─── Ticket integration: vet_referral event type + link column ───────────────
alter type public.ticket_event_type add value if not exists 'vet_referral';

alter table public.health_ticket_events
  add column linked_vet_visit_id uuid
    constraint health_ticket_events_linked_vet_visit_fkey
    references public.vet_visits(id) on delete set null;

create index health_ticket_events_linked_vet_visit_idx
  on public.health_ticket_events(linked_vet_visit_id)
  where linked_vet_visit_id is not null;
