-- Phase 9 — Breeding
-- Adds: mating_records, litters, cat_lineage, heat_logs + enums + RLS

-- ─── Enum types ──────────────────────────────────────────────────────────────
create type public.mating_method  as enum ('natural', 'ai');
create type public.mating_status  as enum ('planned', 'confirmed', 'pregnant', 'delivered', 'failed');
create type public.heat_intensity as enum ('mild', 'moderate', 'strong');

-- ─── mating_records ──────────────────────────────────────────────────────────
create table public.mating_records (
  id                  uuid        primary key default gen_random_uuid(),
  female_cat_id       uuid        not null
                        constraint mating_records_female_cat_fkey
                        references public.cats(id) on delete cascade,
  male_cat_id         uuid        not null
                        constraint mating_records_male_cat_fkey
                        references public.cats(id) on delete cascade,
  mating_date         date        not null,
  mating_method       public.mating_method not null default 'natural',
  expected_labor_date date        generated always as (mating_date + 63) stored,
  status              public.mating_status not null default 'planned',
  notes               text,
  created_by          uuid
                        constraint mating_records_created_by_fkey
                        references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (female_cat_id <> male_cat_id),
  check (notes is null or char_length(notes) <= 5000)
);

-- ─── litters ─────────────────────────────────────────────────────────────────
create table public.litters (
  id                   uuid primary key default gen_random_uuid(),
  mating_record_id     uuid not null
                         constraint litters_mating_record_fkey
                         references public.mating_records(id) on delete cascade,
  birth_date           date not null,
  litter_size_born     int  not null check (litter_size_born > 0),
  litter_size_survived int       check (litter_size_survived is null or litter_size_survived >= 0),
  notes                text,
  created_by           uuid
                         constraint litters_created_by_fkey
                         references public.profiles(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  check (notes is null or char_length(notes) <= 5000)
);

-- ─── cat_lineage ─────────────────────────────────────────────────────────────
-- Stores the parent-child relationship for each kitten created from a litter.
create table public.cat_lineage (
  id        uuid primary key default gen_random_uuid(),
  kitten_id uuid not null
              constraint cat_lineage_kitten_fkey
              references public.cats(id) on delete cascade,
  mother_id uuid
              constraint cat_lineage_mother_fkey
              references public.cats(id) on delete set null,
  father_id uuid
              constraint cat_lineage_father_fkey
              references public.cats(id) on delete set null,
  litter_id uuid
              constraint cat_lineage_litter_fkey
              references public.litters(id) on delete set null,
  unique (kitten_id)  -- one lineage row per kitten
);

-- ─── heat_logs ───────────────────────────────────────────────────────────────
create table public.heat_logs (
  id            uuid primary key default gen_random_uuid(),
  cat_id        uuid not null
                  constraint heat_logs_cat_fkey
                  references public.cats(id) on delete cascade,
  observed_date date not null,
  intensity     public.heat_intensity not null,
  notes         text,
  logged_by     uuid
                  constraint heat_logs_logged_by_fkey
                  references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  check (notes is null or char_length(notes) <= 2000)
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────
create index mating_records_female_cat_idx on public.mating_records(female_cat_id);
create index mating_records_male_cat_idx   on public.mating_records(male_cat_id);
create index mating_records_status_idx     on public.mating_records(status);
create index litters_mating_record_idx     on public.litters(mating_record_id);
create index cat_lineage_kitten_idx        on public.cat_lineage(kitten_id);
create index cat_lineage_mother_idx        on public.cat_lineage(mother_id);
create index cat_lineage_father_idx        on public.cat_lineage(father_id);
create index heat_logs_cat_id_idx          on public.heat_logs(cat_id);
create index heat_logs_observed_date_idx   on public.heat_logs(cat_id, observed_date desc);

-- ─── updated_at triggers ─────────────────────────────────────────────────────
create or replace function public.set_updated_at_breeding()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger mating_records_updated_at
  before update on public.mating_records
  for each row execute function public.set_updated_at_breeding();

create trigger litters_updated_at
  before update on public.litters
  for each row execute function public.set_updated_at_breeding();

-- ─── Row-Level Security ──────────────────────────────────────────────────────
alter table public.mating_records enable row level security;
alter table public.litters        enable row level security;
alter table public.cat_lineage    enable row level security;
alter table public.heat_logs      enable row level security;

-- mating_records: all active users can read; only admins can write
create policy "mating_records_select" on public.mating_records
  for select to authenticated using (true);

create policy "mating_records_insert" on public.mating_records
  for insert to authenticated
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "mating_records_update" on public.mating_records
  for update to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- litters: all active users can read; only admins can write
create policy "litters_select" on public.litters
  for select to authenticated using (true);

create policy "litters_insert" on public.litters
  for insert to authenticated
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- cat_lineage: read-only for all active users; written only by system (via API)
create policy "cat_lineage_select" on public.cat_lineage
  for select to authenticated using (true);

create policy "cat_lineage_insert" on public.cat_lineage
  for insert to authenticated
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- heat_logs: all active users can read + insert; admins can delete
create policy "heat_logs_select" on public.heat_logs
  for select to authenticated using (true);

create policy "heat_logs_insert" on public.heat_logs
  for insert to authenticated with check (true);

create policy "heat_logs_delete" on public.heat_logs
  for delete to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
