-- Vet visit enhancements
--
-- 1) Reuse the lab_results table for receipts too — add a `kind` enum so we
--    can distinguish lab results from receipt photos. Same upload + storage
--    plumbing, separate display sections.
--
-- 2) Allow vet_visit_medicines to optionally schedule themselves as full
--    medications.medication rows. We add columns mirroring the medication
--    schema so the vet form can capture scheduling intent in one go, plus a
--    nullable FK back to the medication row that was generated.

-- ─── 1. Lab results: add `kind` discriminator ───────────────────────────────
create type public.lab_result_kind as enum ('lab_result', 'receipt');

alter table public.lab_results
  add column kind public.lab_result_kind not null default 'lab_result';

create index lab_results_kind_idx on public.lab_results(vet_visit_id, kind);

-- ─── 2. Vet visit medicines: optional scheduling fields ─────────────────────
alter table public.vet_visit_medicines
  add column schedule_enabled boolean not null default false,
  add column schedule_start_date date,
  add column schedule_end_date   date,
  add column schedule_interval_days int check (schedule_interval_days is null or schedule_interval_days between 1 and 365),
  add column schedule_time_slots text[],
  add column schedule_route public.med_route,
  add column generated_medication_id uuid
    constraint vet_visit_medicines_generated_medication_fkey
    references public.medications(id) on delete set null;

create index vet_visit_medicines_generated_idx
  on public.vet_visit_medicines(generated_medication_id)
  where generated_medication_id is not null;
