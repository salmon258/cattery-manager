-- Phase 8 — Health Tickets
-- Adds: health_tickets, health_ticket_events tables + enums + RLS

-- ─── Enum types ──────────────────────────────────────────────────────────────
create type public.ticket_severity as enum ('low', 'medium', 'high', 'critical');
create type public.ticket_status   as enum ('open', 'in_progress', 'resolved');
create type public.ticket_event_type as enum ('comment', 'status_change', 'resolved', 'reopened');

-- ─── health_tickets ──────────────────────────────────────────────────────────
create table public.health_tickets (
  id                 uuid primary key default gen_random_uuid(),
  cat_id             uuid not null references public.cats(id) on delete cascade,
  title              text not null,
  description        text,
  severity           public.ticket_severity not null default 'low',
  status             public.ticket_status   not null default 'open',
  created_by         uuid constraint health_tickets_created_by_fkey
                       references public.profiles(id) on delete set null,
  resolved_at        timestamptz,
  resolved_by        uuid constraint health_tickets_resolved_by_fkey
                       references public.profiles(id) on delete set null,
  resolution_summary text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (char_length(title) <= 200),
  check (description        is null or char_length(description)        <= 5000),
  check (resolution_summary is null or char_length(resolution_summary) <= 5000)
);

-- ─── health_ticket_events ────────────────────────────────────────────────────
create table public.health_ticket_events (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references public.health_tickets(id) on delete cascade,
  event_type  public.ticket_event_type not null,
  note        text,
  new_status  public.ticket_status,
  created_by  uuid constraint health_ticket_events_created_by_fkey
                references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  check (note is null or char_length(note) <= 5000)
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────
create index health_tickets_cat_id_idx
  on public.health_tickets(cat_id);
create index health_tickets_open_idx
  on public.health_tickets(status) where status != 'resolved';
create index health_ticket_events_ticket_id_idx
  on public.health_ticket_events(ticket_id);

-- ─── updated_at trigger ──────────────────────────────────────────────────────
create or replace function public.set_health_ticket_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger health_tickets_updated_at
  before update on public.health_tickets
  for each row execute procedure public.set_health_ticket_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────────────────────
alter table public.health_tickets      enable row level security;
alter table public.health_ticket_events enable row level security;

-- All active users can read tickets
create policy "active_users_read_health_tickets"
  on public.health_tickets for select to authenticated
  using (exists (
    select 1 from public.profiles where id = auth.uid() and is_active = true
  ));

-- Active users can open new tickets
create policy "active_users_insert_health_tickets"
  on public.health_tickets for insert to authenticated
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_active = true)
    and created_by = auth.uid()
  );

-- Only admins can update tickets (status, resolution)
create policy "admins_update_health_tickets"
  on public.health_tickets for update to authenticated
  using (exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_active = true
  ));

-- All active users can read events
create policy "active_users_read_ticket_events"
  on public.health_ticket_events for select to authenticated
  using (exists (
    select 1 from public.profiles where id = auth.uid() and is_active = true
  ));

-- Active users can post events (comments, observations)
create policy "active_users_insert_ticket_events"
  on public.health_ticket_events for insert to authenticated
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_active = true)
    and created_by = auth.uid()
  );
